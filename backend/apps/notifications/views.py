import base64
import hashlib
import hmac
import time

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmailDelivery


def _verify_resend_webhook_signature(request):
    secret = settings.RESEND_WEBHOOK_SECRET
    webhook_id = request.headers.get("svix-id", "")
    timestamp = request.headers.get("svix-timestamp", "")
    signature = request.headers.get("svix-signature", "")
    try:
        timestamp_value = int(timestamp)
        if abs(time.time() - timestamp_value) > 300:
            raise ValueError("stale timestamp")
        key = base64.b64decode(secret.removeprefix("whsec_"), validate=True)
    except (ValueError, TypeError) as exc:
        raise AuthenticationFailed("Invalid webhook signature.") from exc

    signed_payload = (
        f"{webhook_id}.{timestamp}.".encode("utf-8") + request.body
    )
    expected = base64.b64encode(
        hmac.new(key, signed_payload, hashlib.sha256).digest()
    ).decode("ascii")
    if not webhook_id or not any(
        hmac.compare_digest(expected, entry.removeprefix("v1,"))
        for entry in signature.split()
    ):
        raise AuthenticationFailed("Invalid webhook signature.")


class ResendWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def post(self, request):
        if not settings.RESEND_WEBHOOK_SECRET:
            return Response(
                {"detail": "Email webhooks are not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        _verify_resend_webhook_signature(request)
        if not isinstance(request.data, dict):
            return Response(
                {"detail": "The webhook payload is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        event_type = request.data.get("type")
        event_data = request.data.get("data")
        if not isinstance(event_data, dict):
            return Response(
                {"detail": "The webhook event is missing its email identifier."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        provider_message_id = event_data.get("email_id")
        if not provider_message_id:
            return Response(
                {"detail": "The webhook event is missing its email identifier."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_status = {
            "email.delivered": EmailDelivery.Status.DELIVERED,
            "email.bounced": EmailDelivery.Status.BOUNCED,
        }.get(event_type)
        if updated_status:
            EmailDelivery.objects.filter(
                provider_message_id=provider_message_id,
                status__in=[
                    EmailDelivery.Status.PENDING,
                    EmailDelivery.Status.ACCEPTED,
                ],
            ).update(status=updated_status, updated_at=timezone.now())
        return Response({"received": True}, status=status.HTTP_200_OK)
