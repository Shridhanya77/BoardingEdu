import logging

from django.conf import settings
from django.template.loader import render_to_string
from kombu.exceptions import OperationalError
from redis.exceptions import RedisError

from .email_provider import EmailDeliveryError, get_email_provider
from .models import EmailDelivery

logger = logging.getLogger(__name__)


def _render_and_send(delivery, *, heading, body, action_label="", action_url=""):
    context = {
        "heading": heading,
        "body": body,
        "action_label": action_label,
        "action_url": action_url,
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
        body=f"A parent has submitted an admission enquiry for {school_name}. Reference: {enquiry_code}.",
        action_label="Open BoardingEdu",
        action_url=settings.FRONTEND_URL,
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
