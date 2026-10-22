"""Branding and statistics for the Django admin.

Kept out of settings.py so the whole admin configuration lives in one place.
Statistics are computed only on the admin index request, never on change forms.
"""
from datetime import timedelta

from django.contrib import admin
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncMonth
from django.urls import reverse
from django.utils import timezone

SITE_HEADER = "BoardingEdu Administration"
SITE_TITLE = "BoardingEdu Admin"
INDEX_TITLE = "Platform Overview"

TREND_MONTHS = 6


def _card(label, value, url_name=None, tone="neutral", hint=""):
    return {
        "label": label,
        "value": value,
        "hint": hint,
        "tone": tone,
        "url": reverse(f"admin:{url_name}") if url_name else None,
    }


def _enquiry_trend(now):
    """Count new enquiries per month for the last TREND_MONTHS months."""
    start = (now - timedelta(days=31 * TREND_MONTHS)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    from apps.admissions.models import AdmissionEnquiry

    rows = (
        AdmissionEnquiry.objects.filter(created_at__gte=start)
        .annotate(bucket=TruncMonth("created_at"))
        .values("bucket")
        .annotate(n=Count("pk"))
        .order_by("bucket")
    )
    counts = {row["bucket"].strftime("%b"): row["n"] for row in rows if row["bucket"]}

    months = []
    cursor = start
    for _ in range(TREND_MONTHS):
        months.append({"label": cursor.strftime("%b"), "value": counts.get(cursor.strftime("%b"), 0)})
        cursor = (cursor + timedelta(days=32)).replace(day=1)

    peak = max([month["value"] for month in months] + [1])
    for month in months:
        month["pct"] = round(month["value"] / peak * 100)
    return months


def build_stats():
    """Aggregate every admin-facing metric with a small, fixed number of queries."""
    from apps.admissions.models import AdmissionEnquiry
    from apps.geography.models import City, Country, Location, State
    from apps.reviews.models import Review
    from apps.schools.models import School
    from apps.users.models import User

    now = timezone.now()

    schools = School.objects.aggregate(
        total=Count("pk"),
        active=Count("pk", filter=Q(status=True)),
        featured=Count("pk", filter=Q(is_featured=True)),
        verified=Count("pk", filter=Q(verification_status="VERIFIED")),
        pending_verification=Count("pk", filter=Q(verification_status="PENDING")),
    )

    reviews = Review.objects.aggregate(
        total=Count("pk"),
        pending=Count("pk", filter=Q(status=Review.STATUS_PENDING)),
        published=Count("pk", filter=Q(status=Review.STATUS_PUBLISHED)),
        average=Avg("rating"),
    )

    enquiries = AdmissionEnquiry.objects.aggregate(
        total=Count("pk"),
        new=Count("pk", filter=Q(status="NEW")),
        converted=Count("pk", filter=Q(status="CONVERTED")),
        urgent=Count("pk", filter=Q(priority="URGENT")),
    )

    users = User.objects.aggregate(
        total=Count("pk"),
        active=Count("pk", filter=Q(is_active=True)),
        staff=Count("pk", filter=Q(is_staff=True)),
    )
    role_counts = {
        row["role"]: row["n"] for row in User.objects.values("role").annotate(n=Count("pk"))
    }

    cards = [
        _card("Total Schools", schools["total"], "schools_school_changelist", "info", f"{schools['active']} active"),
        _card("Featured Schools", schools["featured"], "schools_school_changelist", "brand", "Shown on homepage"),
        _card("Pending Verification", schools["pending_verification"], "schools_school_changelist", "warn", "Needs review"),
        _card("Pending Reviews", reviews["pending"], "reviews_review_changelist", "warn", "Awaiting moderation"),
        _card("New Enquiries", enquiries["new"], "admissions_admissionenquiry_changelist", "brand", f"{enquiries['total']} total"),
        _card("Active Users", users["active"], "users_user_changelist", "info", f"{users['total']} registered"),
    ]

    coverage = [
        {"label": "Published reviews", "value": reviews["published"]},
        {"label": "Average rating", "value": f"{reviews['average']:.2f}" if reviews["average"] else "\u2014"},
        {"label": "Urgent enquiries", "value": enquiries["urgent"]},
        {"label": "Converted enquiries", "value": enquiries["converted"]},
        {"label": "Verified schools", "value": schools["verified"]},
        {"label": "Staff accounts", "value": users["staff"]},
        {"label": "Countries", "value": Country.objects.count()},
        {"label": "States", "value": State.objects.count()},
        {"label": "Cities", "value": City.objects.count()},
        {"label": "Locations", "value": Location.objects.count()},
    ]

    role_labels = dict(User.ROLE_CHOICES)
    roles = [
        {"label": role_labels.get(role, role), "value": count}
        for role, count in sorted(role_counts.items(), key=lambda item: -item[1])
    ]

    recent_enquiries = list(
        AdmissionEnquiry.objects.select_related("school")
        .order_by("-created_at")
        .values("enquiry_code", "school__school_name", "status", "created_at")[:6]
    )
    recent_reviews = [
        {**row, "url": reverse("admin:reviews_review_change", args=[row["review_id"]])}
        for row in Review.objects.filter(status=Review.STATUS_PENDING)
        .select_related("school")
        .order_by("-created_at")
        .values("review_id", "school__school_name", "rating", "author_name", "created_at")[:6]
    ]

    pending = schools["pending_verification"]
    quick_links = [
        {
            "label": "Verify schools",
            "hint": f"{pending} waiting" if pending else "Queue is clear",
            "url": reverse("admin:schools_school_verification_queue"),
        },
        {
            "label": "Review enquiries",
            "hint": f"{enquiries['new']} new",
            "url": reverse("admin:admissions_admissionenquiry_changelist"),
        },
        {
            "label": "Moderate reviews",
            "hint": f"{reviews['pending']} pending",
            "url": reverse("admin:reviews_review_changelist"),
        },
        {
            "label": "Manage schools",
            "hint": f"{schools['verified']} verified",
            "url": reverse("admin:schools_school_changelist"),
        },
    ]

    return {
        "generated_at": now,
        "cards": cards,
        "quick_links": quick_links,
        "coverage": coverage,
        "roles": roles,
        "months": _enquiry_trend(now),
        "total_reviews": reviews["total"],
        "recent_enquiries": recent_enquiries,
        "recent_reviews": recent_reviews,
    }


def install_admin_dashboard():
    """Set admin branding and inject statistics into the admin index view."""
    admin.site.site_header = SITE_HEADER
    admin.site.site_title = SITE_TITLE
    admin.site.index_title = INDEX_TITLE

    original_index = admin.site.index

    def index(request, extra_context=None):
        context = {"boardingedu_stats": build_stats()}
        if extra_context:
            context.update(extra_context)
        return original_index(request, extra_context=context)

    admin.site.index = index
