"""One-time email codes for parent and school-admin authentication.

Codes live only in Redis, stored as an HMAC. A missing Redis connection
refuses the challenge instead of skipping verification.
"""
import hashlib
import hmac
import json
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.users.models import User

logger = logging.getLogger(__name__)

OTP_ROLES = {User.ROLE_PARENT, User.ROLE_SCHOOL_ADMIN}
PURPOSES = {"register", "login", "password_reset", "email_change"}


class OtpError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


class MemoryOtpStore:
    def __init__(self):
        self.values = {}

    def set(self, key, value, ttl):
        self.values[key] = (value, timezone.now() + timedelta(seconds=ttl))

    def get(self, key):
        item = self.values.get(key)
        if item is None:
            return None
        value, expires = item
        if expires <= timezone.now():
            self.values.pop(key, None)
            return None
        return value

    def delete(self, key):
        self.values.pop(key, None)

    def increment(self, key, ttl):
        current = int(self.get(key) or 0) + 1
        self.set(key, str(current), ttl)
        return current


class RedisOtpStore:
    def __init__(self):
        if not settings.REDIS_URL:
            raise OtpError("otp_store_unavailable")
        from urllib.parse import urlparse
        import os

        host = urlparse(settings.REDIS_URL).hostname or ""
        # Railway's private hostname does not resolve on a local machine, and the
        # DNS lookup hangs longer than the socket timeout.
        if host.endswith(".internal") and not os.getenv("RAILWAY_ENVIRONMENT"):
            raise OtpError("otp_store_unavailable")
        try:
            import redis
            self.client = redis.Redis.from_url(
                settings.REDIS_URL,
                socket_connect_timeout=2,
                socket_timeout=2,
                decode_responses=True,
            )
            self.client.ping()
        except Exception as exc:
            raise OtpError("otp_store_unavailable") from exc

    def set(self, key, value, ttl):
        self.client.set(key, value, ex=ttl)

    def get(self, key):
        return self.client.get(key)

    def delete(self, key):
        self.client.delete(key)

    def increment(self, key, ttl):
        count = self.client.incr(key)
        if count == 1:
            self.client.expire(key, ttl)
        return count


_memory_store = MemoryOtpStore()


class DatabaseOtpStore:
    """Keeps codes when Redis is not running, so the email can still be sent."""

    def _records(self):
        from .models import OtpRecord

        OtpRecord.objects.filter(expires_at__lte=timezone.now()).delete()
        return OtpRecord

    def set(self, key, value, ttl):
        record = self._records()
        record.objects.update_or_create(
            key=key,
            defaults={"value": value, "expires_at": timezone.now() + timedelta(seconds=ttl)},
        )

    def get(self, key):
        row = self._records().objects.filter(key=key).first()
        return row.value if row else None

    def delete(self, key):
        self._records().objects.filter(key=key).delete()

    def increment(self, key, ttl):
        current = int(self.get(key) or 0) + 1
        self.set(key, str(current), ttl)
        return current


def get_store():
    if getattr(settings, "OTP_BACKEND", "redis") == "memory":
        return _memory_store
    if getattr(settings, "OTP_BACKEND", "redis") == "database":
        return DatabaseOtpStore()
    try:
        return RedisOtpStore()
    except OtpError:
        return DatabaseOtpStore()


def generate_code():
    return f"{secrets.randbelow(1_000_000):06d}"


def _digest(user_id, purpose, code):
    payload = f"{purpose}:{user_id}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), payload, hashlib.sha256).hexdigest()


def _key(user_id, purpose):
    return f"otp:{purpose}:{user_id}"


def issue_otp(user, purpose, *, recipient=None, pending_email="", client_ip=""):
    if purpose not in PURPOSES:
        raise OtpError("invalid_purpose")
    store = get_store()
    cooldown_key = f"otp:cooldown:{purpose}:{user.pk}"
    if store.get(cooldown_key):
        raise OtpError("cooldown")
    address = recipient or user.email
    if not address:
        raise OtpError("email_missing")
    if client_ip:
        ip_count = store.increment(f"otp:ip:{purpose}:{client_ip}", 3600)
        if ip_count > 20:
            raise OtpError("rate_limited")
    account_count = store.increment(f"otp:account:{purpose}:{user.pk}", 900)
    if account_count > 8:
        raise OtpError("rate_limited")
    code = generate_code()
    record = json.dumps({
        "digest": _digest(user.pk, purpose, code),
        "attempts": 0,
        "pending_email": pending_email,
    })
    store.set(_key(user.pk, purpose), record, settings.OTP_EXPIRY_SECONDS)
    store.set(cooldown_key, "1", settings.OTP_RESEND_COOLDOWN)
    try:
        _send(address, purpose, code)
    except Exception:
        store.delete(_key(user.pk, purpose))
        store.delete(cooldown_key)
        raise
    return None


def verify_otp(user, purpose, code):
    if purpose not in PURPOSES or not code or len(str(code)) != 6:
        raise OtpError("invalid_code")
    store = get_store()
    raw = store.get(_key(user.pk, purpose))
    if not raw:
        raise OtpError("expired")
    record = json.loads(raw)
    if record.get("attempts", 0) >= settings.OTP_MAX_ATTEMPTS:
        store.delete(_key(user.pk, purpose))
        raise OtpError("too_many_attempts")
    expected = _digest(user.pk, purpose, str(code))
    if not hmac.compare_digest(expected, record.get("digest", "")):
        record["attempts"] = record.get("attempts", 0) + 1
        store.set(_key(user.pk, purpose), json.dumps(record), settings.OTP_EXPIRY_SECONDS)
        if record["attempts"] >= settings.OTP_MAX_ATTEMPTS:
            store.delete(_key(user.pk, purpose))
            raise OtpError("too_many_attempts")
        raise OtpError("invalid_code")
    store.delete(_key(user.pk, purpose))
    return record


def _send(recipient, purpose, code):
    from .email_provider import EmailDeliveryError
    from .models import EmailDelivery

    subjects = {
        "register": "Verify your BoardingEdu email",
        "login": "Your BoardingEdu sign-in code",
        "password_reset": "Your BoardingEdu password reset code",
        "email_change": "Confirm your new BoardingEdu email",
    }
    subject = subjects[purpose]
    text = (
        f"Your BoardingEdu verification code is {code}. "
        "It expires in 5 minutes. If you did not request it, ignore this email."
    )
    html = f"<p>Your BoardingEdu verification code is <strong>{code}</strong>.</p><p>It expires in 5 minutes.</p>"
    delivery = EmailDelivery.objects.create(
        recipient=recipient,
        subject=subject,
        notification_type=f"otp_{purpose}",
    )
    try:
        from .email_provider import get_otp_email_provider

        message_id = get_otp_email_provider().send(
            recipient=recipient,
            subject=subject,
            text=text,
            html=html,
            idempotency_key=str(delivery.delivery_id),
        )
    except EmailDeliveryError as exc:
        delivery.status = EmailDelivery.Status.FAILED
        delivery.error_code = exc.error_code
        delivery.save(update_fields=["status", "error_code", "updated_at"])
        logger.error(
            "OTP email send failed | delivery_id=%s recipient=%s purpose=%s error_code=%s",
            delivery.delivery_id,
            recipient,
            purpose,
            exc.error_code,
        )
        raise OtpError(exc.error_code) from exc
    delivery.status = EmailDelivery.Status.ACCEPTED
    delivery.provider_message_id = message_id or ""
    delivery.save(update_fields=["status", "provider_message_id", "updated_at"])
