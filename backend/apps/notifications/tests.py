import base64
import hashlib
import hmac
import json

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import EmailDelivery


class EmailDeliveryWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_email_otp_endpoints_are_removed(self):
        for path, data in (
            ("/api/notifications/send-otp/", {"email": "parent@example.test"}),
            ("/api/notifications/resend-otp/", {"email": "parent@example.test"}),
            (
                "/api/notifications/verify-otp/",
                {"email": "parent@example.test", "otp": "123456"},
            ),
        ):
            with self.subTest(path=path):
                response = self.client.post(path, data, format="json")
                self.assertEqual(response.status_code, 404)

    @override_settings(RESEND_WEBHOOK_SECRET="")
    def test_resend_webhook_requires_a_configured_secret(self):
        response = self.client.post(
            "/api/notifications/resend-webhook/",
            {"type": "email.delivered", "data": {"email_id": "message-id"}},
            format="json",
        )
        self.assertEqual(response.status_code, 503)

    def test_signed_resend_webhook_tracks_delivery_and_bounce_events(self):
        secret_bytes = b"webhook-test-secret"
        secret = "whsec_" + base64.b64encode(secret_bytes).decode("ascii")
        delivery = EmailDelivery.objects.create(
            recipient="parent@example.test",
            subject="Test",
            notification_type="test",
            status=EmailDelivery.Status.ACCEPTED,
            provider_message_id="resend-message-id",
        )
        timestamp = str(int(timezone.now().timestamp()))

        def post_event(event_type):
            payload = json.dumps({
                "type": event_type,
                "data": {"email_id": "resend-message-id"},
            }).encode()
            webhook_id = "webhook-event-id"
            signed = f"{webhook_id}.{timestamp}.".encode() + payload
            signature = base64.b64encode(
                hmac.new(secret_bytes, signed, hashlib.sha256).digest()
            ).decode("ascii")
            return self.client.post(
                "/api/notifications/resend-webhook/",
                payload,
                content_type="application/json",
                HTTP_SVIX_ID=webhook_id,
                HTTP_SVIX_TIMESTAMP=timestamp,
                HTTP_SVIX_SIGNATURE=f"v1,{signature}",
            )

        with override_settings(RESEND_WEBHOOK_SECRET=secret):
            delivered = post_event("email.delivered")
            self.assertEqual(delivered.status_code, 200, delivered.data)
            delivery.refresh_from_db()
            self.assertEqual(delivery.status, EmailDelivery.Status.DELIVERED)

            delivery.status = EmailDelivery.Status.ACCEPTED
            delivery.save(update_fields=["status"])
            bounced = post_event("email.bounced")
            self.assertEqual(bounced.status_code, 200, bounced.data)
            delivery.refresh_from_db()
            self.assertEqual(delivery.status, EmailDelivery.Status.BOUNCED)
