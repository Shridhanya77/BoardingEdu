"""Saved-search alert matching engine.

Builds a school queryset from a parent's saved filters using the same helpers
as the public school directory, so an alert never surfaces a school the listing
page would not show for the same filters.
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.schools.querysets import (
    annual_fee_subquery,
    public_school_queryset,
    school_type_ids_for_home_category,
)
from apps.users.models import (
    ParentShortlist,
    SavedSearch,
    SavedSearchMatch,
    ShortlistAdmissionNotice,
)

from .models import NotificationPreference, ParentNotification
from .services import queue_email

logger = logging.getLogger(__name__)

FREQUENCY_INTERVALS = {
    SavedSearch.FREQUENCY_INSTANT: timedelta(0),
    SavedSearch.FREQUENCY_DAILY: timedelta(days=1),
    SavedSearch.FREQUENCY_WEEKLY: timedelta(weeks=1),
}


def saved_search_queryset(saved_search):
    """Public schools matching a saved search's filters."""
    queryset = public_school_queryset()

    if saved_search.country_id:
        queryset = queryset.filter(
            country_id=saved_search.country_id,
            state__country_id=saved_search.country_id,
            city__state__country_id=saved_search.country_id,
        )
    if saved_search.state_id:
        queryset = queryset.filter(
            state_id=saved_search.state_id,
            city__state_id=saved_search.state_id,
        )
    if saved_search.city_id:
        queryset = queryset.filter(city_id=saved_search.city_id)
    if saved_search.location_id:
        queryset = queryset.filter(location_id=saved_search.location_id)

    if saved_search.home_category:
        type_ids = school_type_ids_for_home_category(saved_search.home_category)
        if not type_ids:
            return queryset.none()
        queryset = queryset.filter(school_types__in=type_ids)

    type_ids = list(saved_search.school_types.values_list("pk", flat=True))
    if type_ids:
        queryset = queryset.filter(school_types__in=type_ids)

    board_ids = list(saved_search.boards.values_list("pk", flat=True))
    if board_ids:
        queryset = queryset.filter(boards__in=board_ids)

    facility_ids = list(saved_search.facilities.values_list("pk", flat=True))
    if facility_ids:
        queryset = queryset.filter(
            school_facilities__facility__in=facility_ids,
            school_facilities__available=True,
        )

    if saved_search.gender:
        queryset = queryset.filter(gender=saved_search.gender)

    if saved_search.keywords:
        queryset = queryset.filter(school_name__icontains=saved_search.keywords)

    if saved_search.min_fee is not None or saved_search.max_fee is not None:
        queryset = queryset.annotate(annual_fee=annual_fee_subquery())
        if saved_search.min_fee is not None:
            queryset = queryset.filter(annual_fee__gte=saved_search.min_fee)
        if saved_search.max_fee is not None:
            queryset = queryset.filter(annual_fee__lte=saved_search.max_fee)

    return queryset.distinct()


def _search_is_due(saved_search, now):
    if not saved_search.is_active or saved_search.alert_frequency == SavedSearch.FREQUENCY_OFF:
        return False
    interval = FREQUENCY_INTERVALS.get(saved_search.alert_frequency)
    if interval is None:
        return False
    if interval.total_seconds() == 0:
        return True
    last = saved_search.last_notified_at
    return last is None or (now - last) >= interval


def _unsubscribe_url(preference):
    base = settings.FRONTEND_URL
    return f"{base}/unsubscribe/{preference.unsubscribe_token}/"


def _record_matches(saved_search, schools, now):
    """Create dedupe rows for the schools we are about to surface."""
    SavedSearchMatch.objects.bulk_create(
        [
            SavedSearchMatch(saved_search=saved_search, school=school, notified_at=now)
            for school in schools
        ],
        ignore_conflicts=True,
    )


def _notify_saved_search(saved_search, schools, now):
    user = saved_search.parent_profile.user
    if not user.is_active or not user.email:
        return False

    preference = NotificationPreference.for_user(user)
    if preference.is_unsubscribed or not preference.saved_search_alerts:
        logger.info(
            "Saved-search alert skipped by preference",
            extra={"saved_search_id": str(saved_search.saved_search_id), "user_id": user.pk},
        )
        return False

    count = len(schools)
    names = ", ".join(school.school_name for school in schools[:5])
    if count > 5:
        names += f" and {count - 5} more"
    label = saved_search.name or "your saved search"
    subject = f"{count} new school{'s' if count != 1 else ''} match {label}"
    body = (
        f"{count} new school{'s' if count != 1 else ''} match your saved search "
        f"“{label}”: {names}. Review them on your BoardingEdu dashboard."
    )
    queue_email(
        recipient=user.email,
        subject=subject,
        notification_type="saved_search_alert",
        heading="New schools match your saved search",
        body=body,
        action_label="View matching schools",
        action_url=f"{settings.FRONTEND_URL}/dashboard/parent/saved-searches/",
        unsubscribe_url=_unsubscribe_url(preference),
    )
    ParentNotification.objects.create(
        user=user,
        title="New schools match your saved search",
        body=body,
        kind="saved_search",
    )
    return True


def dispatch_saved_search_alerts(now=None):
    """Send alerts for newly added schools that match saved searches."""
    now = now or timezone.now()
    summary = {"searches_checked": 0, "searches_notified": 0, "matches": 0, "emails": 0}

    candidates = (
        SavedSearch.objects.filter(is_active=True)
        .exclude(alert_frequency=SavedSearch.FREQUENCY_OFF)
        .select_related("parent_profile__user", "location", "city", "state", "country")
        .prefetch_related("school_types", "boards", "facilities")
    )

    for saved_search in candidates:
        summary["searches_checked"] += 1
        if not _search_is_due(saved_search, now):
            continue

        since = saved_search.last_notified_at or saved_search.created_at
        already_seen = SavedSearchMatch.objects.filter(
            saved_search=saved_search
        ).values("school_id")
        new_schools = list(
            saved_search_queryset(saved_search)
            .filter(created_at__gt=since)
            .exclude(pk__in=already_seen)
            .order_by("-created_at")[:20]
        )

        # Advance the watermark so the next run only scans newer schools,
        # even when nothing matched this time.
        SavedSearch.objects.filter(pk=saved_search.pk).update(last_notified_at=now)

        if not new_schools:
            continue

        _record_matches(saved_search, new_schools, now)
        summary["searches_notified"] += 1
        summary["matches"] += len(new_schools)
        if _notify_saved_search(saved_search, new_schools, now):
            summary["emails"] += 1

    return summary


def dispatch_admission_opening_alerts(now=None):
    """Notify parents when a shortlisted school opens admissions."""
    now = now or timezone.now()
    summary = {"shortlists_checked": 0, "notices": 0, "emails": 0}

    shortlisted = (
        ParentShortlist.objects.filter(school__status=True, school__admission_open=True)
        .select_related("parent_profile__user", "school")
    )

    for item in shortlisted:
        summary["shortlists_checked"] += 1
        user = item.parent_profile.user
        if not user.is_active or not user.email:
            continue
        if ShortlistAdmissionNotice.objects.filter(
            parent_profile=item.parent_profile, school=item.school
        ).exists():
            continue

        preference = NotificationPreference.for_user(user)
        if preference.is_unsubscribed or not preference.admission_opening_alerts:
            ShortlistAdmissionNotice.objects.create(
                parent_profile=item.parent_profile,
                school=item.school,
                notified_at=now,
            )
            continue

        ShortlistAdmissionNotice.objects.create(
            parent_profile=item.parent_profile,
            school=item.school,
            notified_at=now,
        )
        body = (
            f"{item.school.school_name} has opened admissions. "
            "It is on your shortlist — review the admission details and apply."
        )
        queue_email(
            recipient=user.email,
            subject=f"Admissions open at {item.school.school_name}",
            notification_type="admission_opening_alert",
            heading="A shortlisted school opened admissions",
            body=body,
            action_label="View school",
            action_url=settings.FRONTEND_URL,
            unsubscribe_url=_unsubscribe_url(preference),
        )
        ParentNotification.objects.create(
            user=user,
            title="Admissions opened at a shortlisted school",
            body=body,
            kind="admission_opening",
        )
        summary["notices"] += 1
        summary["emails"] += 1

    return summary


def run_saved_search_alerts(now=None):
    """Entry point used by the periodic Celery beat task."""
    now = now or timezone.now()
    summary = {
        "saved_search": dispatch_saved_search_alerts(now),
        "admission_openings": dispatch_admission_opening_alerts(now),
    }
    logger.info("Saved-search alerts dispatched", extra={"summary": summary})
    return summary
