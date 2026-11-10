import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal

import requests
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import SchoolSubscription, SubscriptionPayment


class PaymentNotConfigured(Exception):
    pass


class PaymentVerificationFailed(Exception):
    pass


def _keys():
    key_id = getattr(settings, "RAZORPAY_KEY_ID", "") or ""
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "") or ""
    if not key_id or not key_secret:
        raise PaymentNotConfigured("Razorpay keys are not configured.")
    return key_id, key_secret


def signature_is_valid(order_id, provider_payment_id, signature):
    _key_id, key_secret = _keys()
    digest = hmac.new(
        key_secret.encode("utf-8"),
        f"{order_id}|{provider_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, signature or "")


def webhook_is_valid(body: bytes, header_signature: str):
    secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "") or ""
    if not secret or not header_signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, header_signature)


def create_razorpay_order(payment: SubscriptionPayment):
    key_id, key_secret = _keys()
    amount_paise = int((payment.amount * Decimal("100")).quantize(Decimal("1")))
    response = requests.post(
        "https://api.razorpay.com/v1/orders",
        auth=(key_id, key_secret),
        json={
            "amount": amount_paise,
            "currency": payment.currency,
            "receipt": str(payment.payment_id),
            "payment_capture": 1,
        },
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    payment.provider_order_id = payload["id"]
    payment.save(update_fields=["provider_order_id"])
    return key_id, amount_paise


def activate_from_provider_payment(payment, provider_payment_id):
    """Open a subscription only after the provider payment id is stored once."""
    with transaction.atomic():
        locked = SubscriptionPayment.objects.select_for_update().get(pk=payment.pk)
        if locked.status == SubscriptionPayment.STATUS_REFUNDED:
            raise PaymentVerificationFailed("This payment was refunded.")
        if locked.subscription_id and locked.status == SubscriptionPayment.STATUS_PAID:
            return locked.subscription
        existing = SubscriptionPayment.objects.filter(
            provider_payment_id=provider_payment_id
        ).exclude(pk=locked.pk).first()
        if existing and existing.subscription_id:
            return existing.subscription
        now = timezone.now()
        subscription = SchoolSubscription.objects.create(
            school=locked.school,
            plan=locked.plan,
            status=SchoolSubscription.STATUS_ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=locked.plan.duration_days),
        )
        locked.status = SubscriptionPayment.STATUS_PAID
        locked.provider_payment_id = provider_payment_id
        locked.subscription = subscription
        locked.verified_at = now
        try:
            locked.save(
                update_fields=[
                    "status",
                    "provider_payment_id",
                    "subscription",
                    "verified_at",
                ]
            )
        except IntegrityError:
            locked.refresh_from_db()
            subscription.delete()
            if locked.subscription_id:
                return locked.subscription
            raise
        return subscription


def provider_event_payment_id(body: bytes):
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, None
    entity = (
        payload.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )
    if payload.get("event") != "payment.captured":
        return None, None
    return entity.get("order_id"), entity.get("id")
