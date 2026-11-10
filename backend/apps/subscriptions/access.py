"""Decide whether a viewer may receive lead contact details.

The check uses the school's subscription rows. A school administrator cannot
turn it on by sending a flag from the browser.
"""
from django.utils import timezone

from apps.users.models import User

from .models import SchoolSubscription


def _own_school_id(user):
    if getattr(user, "role", None) != User.ROLE_SCHOOL_ADMIN:
        return None
    try:
        return user.school_admin_profile.school_id
    except Exception:
        return None


def refresh_expired(school_id):
    if school_id is None:
        return
    SchoolSubscription.objects.filter(
        school_id=school_id,
        status=SchoolSubscription.STATUS_ACTIVE,
        expires_at__lte=timezone.now(),
    ).update(status=SchoolSubscription.STATUS_EXPIRED)


def current_subscription(school):
    if school is None:
        return None
    refresh_expired(school.pk)
    now = timezone.now()
    return (
        SchoolSubscription.objects.select_related("plan")
        .filter(
            school=school,
            status=SchoolSubscription.STATUS_ACTIVE,
            starts_at__lte=now,
            expires_at__gt=now,
            plan__status=True,
            plan__lead_access=True,
        )
        .order_by("-expires_at")
        .first()
    )


def latest_subscription(school):
    if school is None:
        return None
    refresh_expired(school.pk)
    return (
        SchoolSubscription.objects.select_related("plan")
        .filter(school=school)
        .order_by("-created_at")
        .first()
    )


def _within_quota(subscription, enquiry):
    quota = subscription.plan.lead_quota
    if not quota:
        return True
    from apps.admissions.models import AdmissionEnquiry

    allowed = AdmissionEnquiry.objects.filter(school_id=enquiry.school_id).order_by(
        "-created_at"
    ).values_list("pk", flat=True)[:quota]
    return enquiry.pk in set(allowed)


def viewer_can_see_contacts(user, enquiry):
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    role = getattr(user, "role", None)
    if role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN):
        return True
    if role != User.ROLE_SCHOOL_ADMIN:
        return False
    own_school_id = _own_school_id(user)
    if own_school_id is None or enquiry.school_id != own_school_id:
        return False
    subscription = current_subscription(enquiry.school)
    if subscription is None:
        return False
    return _within_quota(subscription, enquiry)


def _iso(value):
    return value.isoformat() if value else None


def subscription_summary(school):
    current = current_subscription(school)
    latest = latest_subscription(school)
    chosen = current or latest
    if chosen is None:
        return {
            "active": False,
            "status": "NONE",
            "plan_name": "",
            "plan_id": None,
            "starts_at": None,
            "expires_at": None,
            "lead_access": False,
            "lead_quota": None,
        }
    return {
        "active": current is not None,
        "status": chosen.status,
        "plan_name": chosen.plan.name,
        "plan_id": str(chosen.plan_id),
        "starts_at": _iso(chosen.starts_at),
        "expires_at": _iso(chosen.expires_at),
        "lead_access": bool(current and chosen.plan.lead_access),
        "lead_quota": chosen.plan.lead_quota,
    }
