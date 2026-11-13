from django.test import TestCase

from .models import SchoolFAQ


class PublicFAQCategoryTests(TestCase):
    def test_published_faqs_are_filterable_by_category(self):
        admissions = SchoolFAQ.objects.create(
            question="How do admissions work?",
            answer="Contact the school for its published process.",
            category="ADMISSIONS",
            status=True,
        )
        SchoolFAQ.objects.create(
            question="What fees are published?",
            answer="Review the school's fee details.",
            category="FEES",
            status=True,
        )
        SchoolFAQ.objects.create(
            question="Draft question",
            answer="Not public.",
            category="ADMISSIONS",
            status=False,
        )

        response = self.client.get("/api/schools/faqs/?category=admissions")

        self.assertEqual(response.status_code, 200)
        self.assertIn(str(admissions.faq_id), [row["faq_id"] for row in response.data])
        self.assertTrue(all(row["category"] == "ADMISSIONS" for row in response.data))
