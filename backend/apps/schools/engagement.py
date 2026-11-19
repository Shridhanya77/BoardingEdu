import math
import uuid
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core import signing
from django.db.models import Avg, Count, Max
from django.utils import timezone
from django.utils.crypto import salted_hmac

from apps.reviews.models import Review
from .models import (
    School,
    SchoolEngagement,
    SchoolEngagementWeight,
    SchoolPopularity,
    SchoolPopularityConfig,
)
from .querysets import public_school_queryset


VISITOR_COOKIE_NAME = "be_visitor"
VISITOR_COOKIE_AGE = 60 * 60 * 24 * 30
VISITOR_COOKIE_SALT = "boardingedu.school-engagement.visitor.v1"
PUBLIC_ENGAGEMENT_EVENTS = (
    SchoolEngagement.EVENT_SCHOOL_VIEW,
    SchoolEngagement.EVENT_LISTING_CLICK,
    SchoolEngagement.EVENT_COMPARE_ADD,
)


@dataclass(frozen=True)
class EngagementResult:
    created: bool
    visitor_cookie: str | None = None


def _visitor_uuid(request):
    token = request.COOKIES.get(VISITOR_COOKIE_NAME)
    if token:
        try:
            return uuid.UUID(
                signing.loads(token, salt=VISITOR_COOKIE_SALT, max_age=VISITOR_COOKIE_AGE)
            ), None
        except (signing.BadSignature, ValueError, TypeError):
            pass

    visitor_id = uuid.uuid4()
    return visitor_id, signing.dumps(str(visitor_id), salt=VISITOR_COOKIE_SALT)


def _identity_hash(request):
    user = request.user
    visitor_cookie = None
    if getattr(user, "is_authenticated", False):
        identity = f"user:{user.pk}"
    else:
        visitor_id, visitor_cookie = _visitor_uuid(request)
        identity = f"visitor:{visitor_id}"
    hashed_identity = salted_hmac(
        "boardingedu.school-engagement.identity.v1",
        identity,
        algorithm="sha256",
    ).hexdigest()

    raw_session_id = request.headers.get("X-Engagement-Session", "")
    try:
        session_id = uuid.UUID(raw_session_id)
    except (ValueError, TypeError, AttributeError):
        session_id = None
    session_hash = (
        salted_hmac(
            "boardingedu.school-engagement.session.v1",
            str(session_id),
            algorithm="sha256",
        ).hexdigest()
        if session_id
        else None
    )
    return hashed_identity, session_hash, visitor_cookie


def attach_visitor_cookie(response, token):
    if token:
        response.set_cookie(
            VISITOR_COOKIE_NAME,
            token,
            max_age=VISITOR_COOKIE_AGE,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            path="/",
        )
    return response


def record_school_engagement(
    school: School,
    event_type: str,
    request,
    *,
    occurred_at=None,
) -> EngagementResult:
    occurred_at = occurred_at or timezone.now()
    identity_hash, session_hash, visitor_cookie = _identity_hash(request)
    user = request.user if getattr(request.user, "is_authenticated", False) else None
    suspicious = SchoolEngagement.objects.filter(
        identity_hash=identity_hash,
        occurred_at__gte=occurred_at - timedelta(hours=1),
        occurred_at__lte=occurred_at,
    ).count() >= 30

    _, created = SchoolEngagement.objects.get_or_create(
        school=school,
        event_type=event_type,
        identity_hash=identity_hash,
        dedupe_bucket=occurred_at.date(),
        defaults={
            "session_hash": session_hash,
            "user": user,
            "occurred_at": occurred_at,
            "suspicious": suspicious,
        },
    )
    return EngagementResult(created=created, visitor_cookie=visitor_cookie)


def recalculate_school_popularity(*, now=None):
    now = now or timezone.now()
    config, _ = SchoolPopularityConfig.objects.get_or_create(config_id=1)
    window_start = now - timedelta(days=config.rolling_window_days)
    configured_weights = {
        row.event_type: float(row.weight) if row.enabled else 0.0
        for row in SchoolEngagementWeight.objects.all()
    }

    count_fields = {
        SchoolEngagement.EVENT_SCHOOL_VIEW: "unique_school_views",
        SchoolEngagement.EVENT_LISTING_CLICK: "unique_listing_clicks",
        SchoolEngagement.EVENT_COMPARE_ADD: "unique_comparisons",
        SchoolEngagement.EVENT_SHORTLIST_ADD: "unique_shortlists",
        SchoolEngagement.EVENT_ENQUIRY_SUBMIT: "unique_enquiries",
    }
    event_rows = (
        SchoolEngagement.objects.filter(
            occurred_at__gte=window_start,
            occurred_at__lte=now,
            school__status=True,
        )
        .order_by()
        .values("school_id", "event_type", "identity_hash")
        .annotate(last_occurred=Max("occurred_at"))
        .iterator(chunk_size=5000)
    )
    engagement_by_school = {}
    for row in event_rows:
        school_id = row["school_id"]
        event_type = row["event_type"]
        stats = engagement_by_school.setdefault(
            school_id,
            {
                "unique_school_views": 0,
                "unique_listing_clicks": 0,
                "unique_comparisons": 0,
                "unique_shortlists": 0,
                "unique_enquiries": 0,
                "engagement_score": 0.0,
            },
        )
        stats[count_fields[event_type]] += 1
        age_days = max((now - row["last_occurred"]).total_seconds() / 86400, 0)
        decay = math.exp(-math.log(2) * age_days / config.half_life_days)
        stats["engagement_score"] += configured_weights.get(event_type, 0.0) * decay

    public_school_ids = list(public_school_queryset().values_list("pk", flat=True))
    review_rows = (
        Review.objects.filter(
            school_id__in=public_school_ids,
            status=Review.STATUS_PUBLISHED,
            is_verified=True,
        )
        .values("school_id")
        .annotate(average_rating=Avg("rating"), review_count=Count("review_id"))
    )
    review_by_school = {row["school_id"]: row for row in review_rows}

    saturation_count = max(config.review_saturation_count, 1)
    quality_weight = float(config.quality_weight)
    popularity_rows = []
    for school_id in public_school_ids:
        events = engagement_by_school.get(school_id, {})
        reviews = review_by_school.get(school_id, {})
        review_count = reviews.get("review_count", 0)
        average_rating = float(reviews.get("average_rating") or 0)
        review_confidence = min(review_count / saturation_count, 1.0)
        quality_score = quality_weight * min(average_rating / 5.0, 1.0) * review_confidence
        engagement_score = float(events.get("engagement_score") or 0)
        popularity_rows.append(
            SchoolPopularity(
                school_id=school_id,
                popularity_score=Decimal(str(engagement_score + quality_score)).quantize(Decimal("0.0001")),
                engagement_score=Decimal(str(engagement_score)).quantize(Decimal("0.0001")),
                quality_score=Decimal(str(quality_score)).quantize(Decimal("0.0001")),
                unique_school_views=events.get("unique_school_views", 0),
                unique_listing_clicks=events.get("unique_listing_clicks", 0),
                unique_comparisons=events.get("unique_comparisons", 0),
                unique_shortlists=events.get("unique_shortlists", 0),
                unique_enquiries=events.get("unique_enquiries", 0),
                window_start=window_start,
                calculated_at=now,
            )
        )

    if popularity_rows:
        SchoolPopularity.objects.bulk_create(
            popularity_rows,
            batch_size=500,
            update_conflicts=True,
            unique_fields=["school"],
            update_fields=[
                "popularity_score",
                "engagement_score",
                "quality_score",
                "unique_school_views",
                "unique_listing_clicks",
                "unique_comparisons",
                "unique_shortlists",
                "unique_enquiries",
                "window_start",
                "calculated_at",
            ],
        )
    return len(popularity_rows)
