import logging

from django.conf import settings
from django.db.models import Q
from django.template.loader import render_to_string
from django.urls import reverse
from kombu.exceptions import OperationalError
from redis.exceptions import RedisError

from .email_provider import EmailDeliveryError, get_email_provider
from .models import AdminPanelNotification, EmailDelivery

logger = logging.getLogger(__name__)


def _create_admin_panel_notifications(*, title, body, url, school_id=None, school_url=""):
    from apps.users.models import User

    platform_admins = User.objects.filter(is_active=True).filter(
        Q(is_superuser=True)
        | Q(role__in=(User.ROLE_STAFF_ADMIN, User.ROLE_SUPER_ADMIN))
    )
    recipients = {user.pk: user for user in platform_admins}
    if school_id is not None:
        school_admins = User.objects.filter(
            is_active=True,
            role=User.ROLE_SCHOOL_ADMIN,
            school_admin_profile__school_id=school_id,
        )
        recipients.update({user.pk: user for user in school_admins})

    notices = []
    for user in recipients.values():
        is_platform_admin = user.is_superuser or user.role in {
            User.ROLE_STAFF_ADMIN,
            User.ROLE_SUPER_ADMIN,
        }
        notices.append(
            AdminPanelNotification(
                recipient=user,
                school_id=(
                    school_id
                    if user.role == User.ROLE_SCHOOL_ADMIN and not is_platform_admin
                    else None
                ),
                title=title,
                body=body,
                url=url if is_platform_admin else school_url,
            )
        )
    return AdminPanelNotification.objects.bulk_create(notices)


def notify_admin_panel_of_enquiry(enquiry):
    detail_url = reverse(
        "admin:admissions_admissionenquiry_change",
        args=[enquiry.pk],
    )
    return _create_admin_panel_notifications(
        school_id=enquiry.school_id,
        title="New admission enquiry",
        body=f"{enquiry.school.school_name} received enquiry {enquiry.enquiry_code}.",
        url=detail_url,
        school_url=detail_url,
    )


def notify_admin_panel_of_counselling_request(counselling_request):
    school = counselling_request.preferred_school
    school_name = school.school_name if school else ""
    body = "A new counselling request was submitted."
    if school_name:
        body = f"A new counselling request was submitted for {school_name}."

    return _create_admin_panel_notifications(
        school_id=counselling_request.preferred_school_id,
        title="New counselling request",
        body=f"{body} Reference: {counselling_request.reference}.",
        url=reverse(
            "admin:admissions_counsellingrequest_change",
            args=[counselling_request.pk],
        ),
    )


def _render_and_send(delivery, *, heading, body, action_label="", action_url="", unsubscribe_url=""):
    context = {
        "heading": heading,
        "body": body,
        "action_label": action_label,
        "action_url": action_url,
        "unsubscribe_url": unsubscribe_url,
        "logo_url": f"{settings.FRONTEND_URL}/BoardingEdu_LOGO.jpeg",
        "frontend_url": settings.FRONTEND_URL,
    }
    try:
        message_id = get_email_provider().send(
            recipient=delivery.recipient,
            subject=delivery.subject,
            text=render_to_string("emails/notification.txt", context),
            html=render_to_string("emails/notification.html", context),
            idempotency_key=str(delivery.delivery_id),
        )
    except EmailDeliveryError as exc:
        delivery.status = EmailDelivery.Status.FAILED
        delivery.error_code = exc.error_code
        delivery.save(update_fields=["status", "error_code", "updated_at"])
        logger.warning(
            "Transactional email delivery failed",
            extra={"delivery_id": str(delivery.delivery_id), "error_code": exc.error_code},
        )
        raise

    delivery.status = EmailDelivery.Status.ACCEPTED
    delivery.provider_message_id = message_id
    delivery.error_code = ""
    delivery.save(update_fields=["status", "provider_message_id", "error_code", "updated_at"])
    return delivery


def send_email_now(
    *,
    recipient,
    subject,
    notification_type,
    heading,
    body,
    action_label="",
    action_url="",
    unsubscribe_url="",
):
    delivery = EmailDelivery.objects.create(
        recipient=recipient,
        subject=subject,
        notification_type=notification_type,
    )
    return _render_and_send(
        delivery,
        heading=heading,
        body=body,
        action_label=action_label,
        action_url=action_url,
        unsubscribe_url=unsubscribe_url,
    )


def queue_email(
    *,
    recipient,
    subject,
    notification_type,
    heading,
    body,
    action_label="",
    action_url="",
    unsubscribe_url="",
):
    delivery = EmailDelivery.objects.create(
        recipient=recipient,
        subject=subject,
        notification_type=notification_type,
    )
    from .tasks import deliver_email

    if settings.REDIS_IS_AVAILABLE:
        try:
            deliver_email.delay(
                str(delivery.delivery_id),
                heading,
                body,
                action_label,
                action_url,
                unsubscribe_url,
            )
        except (OperationalError, RedisError) as exc:
            delivery.status = EmailDelivery.Status.FAILED
            delivery.error_code = "queue_unavailable"
            delivery.save(update_fields=["status", "error_code", "updated_at"])
            logger.error(
                "Could not queue transactional email",
                extra={"delivery_id": str(delivery.delivery_id)},
                exc_info=exc,
            )
    else:
        try:
            _render_and_send(
                delivery,
                heading=heading,
                body=body,
                action_label=action_label,
                action_url=action_url,
                unsubscribe_url=unsubscribe_url,
            )
        except EmailDeliveryError as exc:
            logger.info(
                "Non-critical notification was not delivered",
                extra={
                    "delivery_id": str(delivery.delivery_id),
                    "error_code": exc.error_code,
                },
            )
    return delivery


def send_password_reset_notification(recipient):
    return queue_email(
        recipient=recipient,
        subject="Password reset requested for BoardingEdu",
        notification_type="password_reset_notification",
        heading="Password reset requested",
        body="A password reset was requested for your BoardingEdu account. If this was not you, secure your account and contact support.",
        action_label="Visit BoardingEdu",
        action_url=settings.FRONTEND_URL,
    )


def send_admission_enquiry_confirmation(recipient, school_name, enquiry_code):
    return queue_email(
        recipient=recipient,
        subject=f"Your admission enquiry for {school_name}",
        notification_type="admission_enquiry_confirmation",
        heading="Your enquiry has been received",
        body=f"Your enquiry for {school_name} has been received. Reference: {enquiry_code}.",
        action_label="Explore BoardingEdu",
        action_url=settings.FRONTEND_URL,
    )


def send_school_enquiry_notification(recipient, school_name, enquiry_code):
    return queue_email(
        recipient=recipient,
        subject=f"New admission enquiry for {school_name}",
        notification_type="school_admission_enquiry",
        heading="A new admission enquiry was received",
        body=f"A family has submitted an admission enquiry for {school_name}. Reference: {enquiry_code}.",
        action_label="Open BoardingEdu",
        action_url=settings.FRONTEND_URL,
    )


def send_platform_enquiry_notification(recipient, school_name, enquiry_code):
    return queue_email(
        recipient=recipient,
        subject=f"New school enquiry requires review: {school_name}",
        notification_type="platform_admission_enquiry",
        heading="A new admission enquiry was received",
        body=(
            f"A family has submitted an enquiry for {school_name}. "
            f"Reference: {enquiry_code}. Review the lead and coordinate follow-up."
        ),
        action_label="Review enquiries",
        action_url=f"{settings.FRONTEND_URL}/dashboard/staff-admin/",
    )


def send_school_admin_notification(recipient, subject, body):
    return queue_email(
        recipient=recipient,
        subject=subject,
        notification_type="school_admin_notification",
        heading="School account notification",
        body=body,
        action_label="Open your school account",
        action_url=f"{settings.FRONTEND_URL}/dashboard/school/",
    )


def send_school_staff_notification(recipient, subject, body):
    return queue_email(
        recipient=recipient,
        subject=subject,
        notification_type="school_staff_notification",
        heading="School staff account notification",
        body=body,
        action_label="Visit BoardingEdu",
        action_url=settings.FRONTEND_URL,
    )


def send_parent_account_notification(recipient, subject, body):
    return queue_email(
        recipient=recipient,
        subject=subject,
        notification_type="parent_account_notification",
        heading="Parent account notification",
        body=body,
        action_label="Open your account",
        action_url=f"{settings.FRONTEND_URL}/dashboard/parent/",
    )
