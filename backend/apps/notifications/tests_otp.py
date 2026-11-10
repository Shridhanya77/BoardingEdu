from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.notifications.otp import MemoryOtpStore, get_store
from apps.users.models import User

SETTINGS = dict(
    OTP_BACKEND="memory",
    CLOUDFLARE_EMAIL_API_TOKEN="test-token",
    CLOUDFLARE_EMAIL_ACCOUNT_ID="test-account",
    CLOUDFLARE_EMAIL_FROM="no-reply@boardingedu.com",
    OTP_EXPIRY_SECONDS=300,
    OTP_RESEND_COOLDOWN=60,
    OTP_MAX_ATTEMPTS=5,
)


def accepted(email):
    response = type("Response", (), {})()
    response.status_code = 200
    response.ok = True
    response.json = lambda: {
        "success": True,
        "result": {"delivered": [email], "queued": [], "message_id": "cf-test"},
    }
    return response


@override_settings(**SETTINGS)
class EmailOtpTests(TestCase):
    def setUp(self):
        store = get_store()
        if isinstance(store, MemoryOtpStore):
            store.values.clear()
        self.parent = User.objects.create_user(
            username="otp-parent",
            email="otp-parent@example.test",
            password="secret-pass",
            role=User.ROLE_PARENT,
            is_email_verified=False,
        )
        self.client = APIClient()

    def test_correct_code_verifies_and_cannot_be_reused(self):
        with patch("apps.notifications.otp.generate_code", return_value="111111"), patch(
            "apps.notifications.email_provider.requests.post", return_value=accepted(self.parent.email)
        ):
            self.client.post(
                "/api/auth/otp/resend/",
                {"email": self.parent.email, "purpose": "register"},
                format="json",
            )
            verified = self.client.post(
                "/api/auth/otp/verify/",
                {"email": self.parent.email, "otp": "111111", "purpose": "register"},
                format="json",
            )
        self.assertEqual(verified.status_code, 200, verified.data)
        self.assertIn("access", verified.data)
        self.parent.refresh_from_db()
        self.assertTrue(self.parent.is_email_verified)
        again = self.client.post(
            "/api/auth/otp/verify/",
            {"email": self.parent.email, "otp": "111111", "purpose": "register"},
            format="json",
        )
        self.assertEqual(again.status_code, 400)

    def test_wrong_expired_attempts_cooldown_and_provider_failure(self):
        with patch("apps.notifications.otp.generate_code", return_value="222222"), patch(
            "apps.notifications.email_provider.requests.post", return_value=accepted(self.parent.email)
        ):
            self.client.post("/api/auth/otp/resend/", {"email": self.parent.email, "purpose": "register"}, format="json")
            wrong = self.client.post(
                "/api/auth/otp/verify/",
                {"email": self.parent.email, "otp": "000000", "purpose": "register"},
                format="json",
            )
            cooldown = self.client.post(
                "/api/auth/otp/resend/",
                {"email": self.parent.email, "purpose": "register"},
                format="json",
            )
        self.assertEqual(wrong.status_code, 400)
        self.assertEqual(cooldown.status_code, 429)
        get_store().values.clear()
        with patch("apps.notifications.otp.generate_code", return_value="333333"), patch(
            "apps.notifications.email_provider.requests.post", return_value=accepted(self.parent.email)
        ):
            self.client.post("/api/auth/otp/resend/", {"email": self.parent.email, "purpose": "register"}, format="json")
        get_store().values.clear()
        expired = self.client.post(
            "/api/auth/otp/verify/",
            {"email": self.parent.email, "otp": "333333", "purpose": "register"},
            format="json",
        )
        self.assertEqual(expired.status_code, 400)
        with patch("apps.notifications.otp.generate_code", return_value="444444"), patch(
            "apps.notifications.email_provider.requests.post", return_value=accepted(self.parent.email)
        ):
            self.client.post("/api/auth/otp/resend/", {"email": self.parent.email, "purpose": "register"}, format="json")
            for _ in range(5):
                blocked = self.client.post(
                    "/api/auth/otp/verify/",
                    {"email": self.parent.email, "otp": "000000", "purpose": "register"},
                    format="json",
                )
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("new code", blocked.data["detail"])
        get_store().delete(f"otp:cooldown:register:{self.parent.pk}")
        failed = type("Response", (), {"status_code": 403, "ok": False, "json": lambda self: {"success": False, "errors": [{"code": 10105}]}})()
        with patch("apps.notifications.email_provider.requests.post", return_value=failed):
            provider = self.client.post(
                "/api/auth/otp/resend/",
                {"email": self.parent.email, "purpose": "register"},
                format="json",
            )
        self.assertEqual(provider.status_code, 503)

    @override_settings(OTP_BACKEND="redis", REDIS_URL="")
    def test_redis_failure_does_not_issue_a_token(self):
        self.parent.is_email_verified = True
        self.parent.save(update_fields=["is_email_verified"])
        response = self.client.post(
            "/api/auth/jwt/token/",
            {"username": "otp-parent", "password": "secret-pass"},
            format="json",
        )
        self.assertNotEqual(response.status_code, 201)
        self.assertNotIn("access", getattr(response, "data", {}))

    def test_password_reset_otp_and_unverified_login(self):
        self.parent.is_email_verified = True
        self.parent.save(update_fields=["is_email_verified"])
        with patch("apps.notifications.otp.generate_code", return_value="555555"), patch(
            "apps.notifications.email_provider.requests.post", return_value=accepted(self.parent.email)
        ):
            requested = self.client.post("/api/users/password-reset/", {"email": self.parent.email}, format="json")
            reset = self.client.post(
                "/api/auth/otp/verify/",
                {"email": self.parent.email, "otp": "555555", "purpose": "password_reset", "password": "another-pass-9"},
                format="json",
            )
        self.assertEqual(requested.status_code, 200, requested.data)
        self.assertEqual(reset.status_code, 200, reset.data)
        self.assertTrue(self.parent.check_password("another-pass-9") or User.objects.get(pk=self.parent.pk).check_password("another-pass-9"))
        self.parent.is_email_verified = False
        self.parent.save(update_fields=["is_email_verified"])
        with patch("apps.notifications.otp.generate_code", return_value="666666"), patch(
            "apps.notifications.email_provider.requests.post", return_value=accepted(self.parent.email)
        ):
            denied = self.client.post(
                "/api/auth/jwt/token/",
                {"username": "otp-parent", "password": "another-pass-9"},
                format="json",
            )
        self.assertEqual(denied.status_code, 200, denied.data)
        self.assertTrue(denied.data.get("otp_required"))
        self.assertNotIn("access", denied.data)
