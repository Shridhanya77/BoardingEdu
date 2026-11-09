import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from kombu.exceptions import OperationalError
from redis.exceptions import RedisError

from .email_provider import EmailDeliveryError, get_email_provider
from .models import EmailDelivery, EmailOTP

logger = logging.getLogger(__name__)
OTP_EXPIRY = timedelta(minutes=5)
OTP_RESEND_COOLDOWN = timedelta(seconds=60)
OTP_MAX_ATTEMPTS = 5


def _otp_digest(user_id, email, otp):
    message = f"{user_id}:{email}:{otp}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def _render_and_send(delivery, *, heading, body, otp="", action_label="", action_url=""):
    context = {
        "heading": heading,
        "body": body,
        "otp": otp,
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
    otp="",
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
        otp=otp,
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


def issue_and_send_otp(user, *, enforce_cooldown=False):
    if (
        user.is_email_verified
        or user.role not in {user.ROLE_PARENT, user.ROLE_SCHOOL_ADMIN}
    ):
        return False

    with transaction.atomic():
        locked_user = type(user).objects.select_for_update().get(pk=user.pk)
        if locked_user.is_email_verified:
            return False
        latest = EmailOTP.objects.filter(user=locked_user).first()
        if (
            enforce_cooldown
            and latest
            and timezone.now() - latest.created_at < OTP_RESEND_COOLDOWN
        ):
            return False
        email = locked_user.email.strip().lower()
        otp = f"{secrets.randbelow(1_000_000):06d}"
        now = timezone.now()
        EmailOTP.objects.filter(user=locked_user, is_used=False).update(is_used=True)
        otp_record = EmailOTP.objects.create(
            user=locked_user,
            email=email,
            otp_hash=_otp_digest(locked_user.pk, email, otp),
            expires_at=now + OTP_EXPIRY,
        )
    try:
        _render_and_send(
            EmailDelivery.objects.create(
                recipient=email,
                subject="Verify your BoardingEdu email",
                notification_type="email_verification_otp",
            ),
            heading="Verify your email address",
            body="Enter this one-time code to verify your BoardingEdu account. It expires in five minutes.",
            otp=otp,
            action_label="Visit BoardingEdu",
            action_url=settings.FRONTEND_URL,
        )
    except EmailDeliveryError:
        logger.exception(
            "Unable to deliver email verification code",
            extra={"user_id": locked_user.pk, "otp_id": otp_record.pk},
        )
        raise
    return True


def resend_otp_for_email(email):
    normalized_email = email.strip().lower()
    users = list(
        get_user_model().objects.filter(email__iexact=normalized_email).order_by("pk")[:2]
    )
    if len(users) != 1 or users[0].is_email_verified:
        return False

    return issue_and_send_otp(users[0], enforce_cooldown=True)


def verify_otp_for_email(email, otp):
    normalized_email = email.strip().lower()
    matching_users = get_user_model().objects.filter(email__iexact=normalized_email)
    if matching_users.count() != 1:
        return False

    with transaction.atomic():
        user = get_user_model().objects.select_for_update().get(pk=matching_users.first().pk)
        if user.is_email_verified:
            return False

        otp_record = EmailOTP.objects.select_for_update().filter(
            user=user,
            email=normalized_email,
            is_used=False,
        ).first()
        if otp_record is None:
            return False

        if otp_record.expires_at <= timezone.now():
            otp_record.is_used = True
            otp_record.save(update_fields=["is_used"])
            return False

        expected = _otp_digest(user.pk, normalized_email, otp)
        if not hmac.compare_digest(otp_record.otp_hash, expected):
            otp_record.attempts += 1
            update_fields = ["attempts"]
            if otp_record.attempts >= OTP_MAX_ATTEMPTS:
                otp_record.is_used = True
                update_fields.append("is_used")
            otp_record.save(update_fields=update_fields)
            return False

        otp_record.is_used = True
        otp_record.save(update_fields=["is_used"])
        user.is_email_verified = True
        user.email_verified_at = timezone.now()
        user.save(update_fields=["is_email_verified", "email_verified_at"])
    queue_email(
        recipient=normalized_email,
        subject="Your BoardingEdu email is verified",
        notification_type="email_verification_success",
        heading="Email verified successfully",
        body="Your BoardingEdu email address is verified. You can now sign in.",
        action_label="Log in",
        action_url=f"{settings.FRONTEND_URL}/login",
    )
    queue_email(
        recipient=normalized_email,
        subject="Welcome to BoardingEdu",
        notification_type="welcome",
        heading="Welcome to BoardingEdu",
        body="Thank you for joining BoardingEdu. We are here to help you connect with the right school community.",
        action_label="Explore BoardingEdu",
        action_url=settings.FRONTEND_URL,
    )
    return True


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
