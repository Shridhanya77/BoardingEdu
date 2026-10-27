from datetime import datetime, timezone as datetime_timezone
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase

from config.admin_dashboard import _enquiry_trend


class AdminDashboardTrendTests(SimpleTestCase):
    def test_trend_includes_current_month_in_six_month_window(self):
        query = MagicMock()
        query.annotate.return_value = query
        query.values.return_value = query
        query.order_by.return_value = [
            {"bucket": datetime(2026, 1, 1, tzinfo=datetime_timezone.utc), "n": 3}
        ]

        with patch(
            "apps.admissions.models.AdmissionEnquiry.objects.filter",
            return_value=query,
        ):
            months = _enquiry_trend(
                datetime(2026, 1, 15, 12, tzinfo=datetime_timezone.utc)
            )

        self.assertEqual(
            [month["label"] for month in months],
            ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"],
        )
        self.assertEqual(months[-1]["value"], 3)
        self.assertEqual(len(months), 6)


class HealthProbeTests(TestCase):
    def test_healthz_reports_ok_and_version(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("version", payload)

    def test_readyz_reports_each_dependency(self):
        response = self.client.get("/readyz")
        self.assertIn(response.status_code, (200, 503))
        payload = response.json()
        self.assertIn("status", payload)
        self.assertIn("checks", payload)
        self.assertIn("database", payload["checks"])
        self.assertTrue(payload["checks"]["database"]["critical"])

    def test_readyz_is_ready_when_database_is_available(self):
        response = self.client.get("/readyz")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["checks"]["database"]["ok"])

    def test_healthz_rejects_non_get_methods(self):
        response = self.client.post("/healthz")
        self.assertEqual(response.status_code, 405)
