"""Parent-facing application status, timeline, and notifications.

School CRM statuses stay on AdmissionEnquiry.status. Parents follow
application_status, which schools update from the school admin panel.
"""
from django.utils import timezone

CRM_TO_APPLICATION = {
    "NEW": "SUBMITTED",
    "ASSIGNED": "RECEIVED",
    "IN_PROGRESS": "UNDER_REVIEW",
    "CALL_BACK": "INTERACTION_SCHEDULED",
    "CONVERTED": "OFFERED",
    "CLOSED_LOST": "REJECTED",
}

TERMINAL_APPLICATION_STATUSES = {"REJECTED", "WITHDRAWN", "ACCEPTED"}
OPEN_APPLICATION_STATUSES = {
    "SUBMITTED",
    "RECEIVED",
    "UNDER_REVIEW",
    "DOCUMENTS_REQUIRED",
    "INTERACTION_SCHEDULED",
    "INTERACTION_COMPLETED",
    "OFFERED",
}

STATUS_EMAILS = {
    "RECEIVED": "The school has received your application.",
    "UNDER_REVIEW": "The school is reviewing your application.",
    "DOCUMENTS_REQUIRED": "The school needs additional documents.",
    "INTERACTION_SCHEDULED": "The school has scheduled an interaction.",
    "INTERACTION_COMPLETED": "The scheduled interaction has been completed.",
    "OFFERED": "The school has offered admission.",
    "ACCEPTED": "The admission offer has been accepted.",
    "REJECTED": "The school has not offered admission.",
    "WITHDRAWN": "This application has been withdrawn.",
}


def application_label(code):
    from .models import AdmissionEnquiry

    return dict(AdmissionEnquiry.APPLICATION_STATUS_CHOICES).get(code, code)


def prepare_application_status(enquiry):
    """Map a CRM status change onto the parent-facing status before save."""
    if enquiry._state.adding or not enquiry.pk:
        return None
    from .models import AdmissionEnquiry

    previous = (
        AdmissionEnquiry.objects.filter(pk=enquiry.pk)
        .values("application_status", "status")
        .first()
    )
    if previous is None:
        return None
    crm_changed = previous["status"] != enquiry.status
    application_unchanged = previous["application_status"] == enquiry.application_status
    if crm_changed and application_unchanged:
        mapped = CRM_TO_APPLICATION.get(enquiry.status)
        if mapped:
            enquiry.application_status = mapped
    return previous


def sync_application_timeline(enquiry, previous):
    from .models import ApplicationStatusEvent

    remarks = (getattr(enquiry, "_status_remarks", "") or "")[:1000]
    instructions = (getattr(enquiry, "_status_instructions", "") or "")[:1000]
    if previous is None:
        if not enquiry.status_events.exists():
            ApplicationStatusEvent.objects.create(
                enquiry=enquiry,
                status=enquiry.application_status or "SUBMITTED",
                remarks=remarks or "Admission enquiry submitted.",
                instructions=instructions,
            )
            _notify(enquiry, created=True)
        return
    changed = previous["application_status"] != enquiry.application_status
    if not changed and not remarks and not instructions:
        return
    ApplicationStatusEvent.objects.create(
        enquiry=enquiry,
        status=enquiry.application_status,
        remarks=remarks,
        instructions=instructions,
    )
    if changed:
        _notify(enquiry, created=False)


def find_open_duplicate(parent_profile, school, academic_year, grade, child):
    from .models import AdmissionEnquiry

    if parent_profile is None or school is None or academic_year is None:
        return None
    return (
        AdmissionEnquiry.objects.filter(
            parent_profile=parent_profile,
            school=school,
            academic_year=academic_year,
            applying_for_grade=grade,
            child=child,
            application_status__in=OPEN_APPLICATION_STATUSES,
        )
        .order_by("-created_at")
        .first()
    )


def _notify(enquiry, created):
    profile = enquiry.parent_profile
    user = getattr(profile, "user", None) if profile is not None else None
    if user is None:
        return
    label = application_label(enquiry.application_status)
    school_name = enquiry.school.school_name if enquiry.school_id else "the school"
    if created:
        title = f"Enquiry submitted to {school_name}"
        body = f"Your enquiry {enquiry.enquiry_code} has been submitted."
    else:
        title = f"{school_name}: {label}"
        body = STATUS_EMAILS.get(enquiry.application_status, f"Status is now {label}.")
    from apps.notifications.models import ParentNotification

    ParentNotification.objects.create(
        user=user,
        enquiry=enquiry,
        title=title,
        body=body,
        kind="application",
    )
    if created or not user.email:
        return
    from apps.notifications.services import send_parent_account_notification
    from apps.notifications.sms import queue_application_sms

    send_parent_account_notification(
        user.email,
        title,
        f"{body} Reference {enquiry.enquiry_code}.",
    )
    queue_application_sms(user.phone, f"{title}. Reference {enquiry.enquiry_code}.")


def mark_withdrawn(enquiry, remarks):
    enquiry.application_status = "WITHDRAWN"
    enquiry.closed_at = timezone.now()
    enquiry._status_remarks = remarks or "Withdrawn by the parent."
    enquiry.save(update_fields=["application_status", "closed_at", "updated_at"])
