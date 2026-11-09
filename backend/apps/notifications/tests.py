import base64
import hashlib
import hmac
import json
import re
from datetime import timedelta
from unittest.mock import Mock, patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.geography.models import City, Country, State
from apps.schools.models import School
from apps.users.models import SchoolAdminProfile, User

from .email_provider import EmailDeliveryError
from .models import EmailDelivery, EmailOTP
from .services import (
    issue_and_send_otp,
    resend_otp_for_email,
    verify_otp_for_email,
)


class EmailVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = User.objects.create_user(
            username="otp-parent",
            email="parent@example.test",
            password="secret-pass",
            role=User.ROLE_PARENT,
        )

    def mock_provider(self):
        provider = Mock()
        provider.send.return_value = "resend-message-id"
        return patch(
            "apps.notifications.services.get_email_provider",
            return_value=provider,
        ), provider

    @staticmethod
    def code_from(provider):
        message = provider.send.call_args.kwargs["text"]
        return re.search(r"Your verification code: (\d{6})", message).group(1)

    def test_registration_generates_hashed_code_and_returns_generic_response(self):
        patcher, provider = self.mock_provider()
        with patcher:
            response = self.client.post(
                "/api/users/users/register/",
                {
                    "username": "new-parent",
                    "email": "New.Parent@Example.test",
                    "first_name": "New",
                    "last_name": "Parent",
                    "phone": "+919876543210",
                    "password": "secret-pass",
                    "password_confirm": "secret-pass",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(
            response.data,
            {"detail": "If this email can be registered, a verification code will be sent."},
        )
        user = User.objects.get(username="new-parent")
        otp_record = EmailOTP.objects.get(user=user)
        code = self.code_from(provider)
        self.assertFalse(user.is_email_verified)
        self.assertNotEqual(otp_record.otp_hash, code)
        self.assertAlmostEqual(
            (otp_record.expires_at - otp_record.created_at).total_seconds(),
            300,
            delta=1,
        )
        self.assertEqual(
            EmailDelivery.objects.get(notification_type="email_verification_otp").status,
            EmailDelivery.Status.ACCEPTED,
        )

    def test_successful_verification_is_single_use_and_emits_notifications(self):
        patcher, provider = self.mock_provider()
        with patcher, patch("apps.notifications.services.queue_email") as queue_email:
            issue_and_send_otp(self.parent)
            code = self.code_from(provider)

            self.assertTrue(verify_otp_for_email(self.parent.email, code))
            self.parent.refresh_from_db()
            self.assertTrue(self.parent.is_email_verified)
            self.assertIsNotNone(self.parent.email_verified_at)
            self.assertFalse(verify_otp_for_email(self.parent.email, code))
            self.assertEqual(queue_email.call_count, 2)

    def test_wrong_code_exhausts_attempts_and_invalidates_otp(self):
        patcher, provider = self.mock_provider()
        with patcher:
            issue_and_send_otp(self.parent)
            wrong_code = f"{(int(self.code_from(provider)) + 1) % 1_000_000:06d}"

        for _ in range(5):
            self.assertFalse(verify_otp_for_email(self.parent.email, wrong_code))

        otp_record = EmailOTP.objects.get(user=self.parent)
        self.assertEqual(otp_record.attempts, 5)
        self.assertTrue(otp_record.is_used)

    def test_expired_code_is_rejected(self):
        patcher, provider = self.mock_provider()
        with patcher:
            issue_and_send_otp(self.parent)
            code = self.code_from(provider)
        EmailOTP.objects.filter(user=self.parent).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        self.assertFalse(verify_otp_for_email(self.parent.email, code))
        self.assertTrue(EmailOTP.objects.get(user=self.parent).is_used)

    def test_resend_cooldown_does_not_create_another_code(self):
        patcher, provider = self.mock_provider()
        with patcher:
            issue_and_send_otp(self.parent)
            self.assertFalse(resend_otp_for_email(self.parent.email))

        self.assertEqual(EmailOTP.objects.filter(user=self.parent).count(), 1)

    def test_resend_after_cooldown_invalidates_the_previous_code(self):
        patcher, provider = self.mock_provider()
        with patcher:
            issue_and_send_otp(self.parent)
            first_code = self.code_from(provider)
            EmailOTP.objects.filter(user=self.parent).update(
                created_at=timezone.now() - timedelta(seconds=61)
            )
            self.assertTrue(resend_otp_for_email(self.parent.email))

        records = list(EmailOTP.objects.filter(user=self.parent).order_by("-created_at"))
        self.assertEqual(len(records), 2)
        self.assertTrue(records[1].is_used)
        self.assertFalse(verify_otp_for_email(self.parent.email, first_code))

    def test_duplicate_email_registration_has_same_public_response(self):
        response = self.client.post(
            "/api/users/users/register/",
            {
                "username": "another-parent",
                "email": self.parent.email.upper(),
                "first_name": "Another",
                "last_name": "Parent",
                "phone": "+919876543210",
                "password": "secret-pass",
                "password_confirm": "secret-pass",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(
            response.data,
            {"detail": "If this email can be registered, a verification code will be sent."},
        )
        self.assertEqual(User.objects.filter(email__iexact=self.parent.email).count(), 1)

    def test_provider_failure_is_recorded_without_exposing_code_or_account_status(self):
        patcher, provider = self.mock_provider()
        provider.send.side_effect = EmailDeliveryError("provider_temporary_error")
        with patcher:
            response = self.client.post(
                "/api/notifications/send-otp/",
                {"email": self.parent.email},
                format="json",
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(
            response.data,
            {"detail": "If the account can be verified, an email with further instructions will be sent."},
        )
        self.assertEqual(
            EmailDelivery.objects.get(notification_type="email_verification_otp").status,
            EmailDelivery.Status.FAILED,
        )
        self.assertNotIn("otp", str(response.data).lower())

    def test_unverified_parent_cannot_obtain_or_refresh_jwt(self):
        token = RefreshToken.for_user(self.parent)
        login = self.client.post(
            "/api/auth/jwt/token/",
            {"username": self.parent.username, "password": "secret-pass"},
            format="json",
        )
        refresh = self.client.post(
            "/api/auth/jwt/token/refresh/",
            {"refresh": str(token)},
            format="json",
        )

        self.assertEqual(login.status_code, 401)
        self.assertEqual(refresh.status_code, 401)
        self.assertNotIn("access", login.data)
        self.assertNotIn("access", refresh.data)

    def test_verified_parent_can_obtain_refresh_and_access_protected_api(self):
        self.parent.is_email_verified = True
        self.parent.save(update_fields=["is_email_verified"])

        login = self.client.post(
            "/api/auth/jwt/token/",
            {"username": self.parent.email, "password": "secret-pass"},
            format="json",
        )
        self.assertEqual(login.status_code, 200, login.data)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login.data['access']}"
        )
        profile = self.client.get("/api/users/users/me/")
        self.assertEqual(profile.status_code, 200)
        self.assertTrue(profile.data["is_email_verified"])

        refreshed = self.client.post(
            "/api/auth/jwt/token/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
        )
        self.assertEqual(refreshed.status_code, 200, refreshed.data)
        self.assertIn("access", refreshed.data)

    def test_school_admin_must_verify_but_staff_admin_login_is_preserved(self):
        country = Country.objects.create(
            country_code="IN", country_name="India", slug="otp-india"
        )
        state = State.objects.create(
            country=country, state_code="KA", state_name="Karnataka", slug="otp-ka"
        )
        city = City.objects.create(
            state=state, city_code="BLR", city_name="Bengaluru", slug="otp-blr"
        )
        school = School.objects.create(
            school_code="OTP-SCHOOL",
            school_name="OTP School",
            slug="otp-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            verification_status="PENDING",
        )
        school_admin = User.objects.create_user(
            username="otp-school-admin",
            email="school-admin@example.test",
            password="secret-pass",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        SchoolAdminProfile.objects.create(user=school_admin, school=school)
        rejected = self.client.post(
            "/api/auth/jwt/token/",
            {"username": school_admin.username, "password": "secret-pass"},
            format="json",
        )
        self.assertEqual(rejected.status_code, 401)
        admin_rejected = self.client.post(
            "/admin/login/",
            {"username": school_admin.username, "password": "secret-pass"},
        )
        self.assertEqual(admin_rejected.status_code, 200)
        self.assertContains(admin_rejected, "Email verification is required")

        school_admin.is_email_verified = True
        school_admin.save(update_fields=["is_email_verified"])
        accepted = self.client.post(
            "/api/auth/jwt/token/",
            {"username": school_admin.username, "password": "secret-pass"},
            format="json",
        )
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {accepted.data['access']}"
        )
        pending_dashboard = self.client.get("/api/dashboards/school/")
        self.assertEqual(pending_dashboard.status_code, 200)
        self.assertEqual(pending_dashboard.data["panel_access"], "pending")
        self.assertEqual(
            pending_dashboard.data["school"]["verification_status"], "PENDING"
        )
        self.client.credentials()

        admin_accepted = self.client.post(
            "/admin/login/",
            {"username": school_admin.username, "password": "secret-pass"},
        )
        self.assertEqual(admin_accepted.status_code, 302)

        staff_admin = User.objects.create_user(
            username="otp-staff-admin",
            email="staff-admin@example.test",
            password="secret-pass",
            role=User.ROLE_STAFF_ADMIN,
        )
        staff_login = self.client.post(
            "/api/auth/jwt/token/",
            {"username": staff_admin.username, "password": "secret-pass"},
            format="json",
        )
        self.assertEqual(staff_login.status_code, 200, staff_login.data)

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
