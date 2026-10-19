from django.test import TestCase


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
