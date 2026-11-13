from datetime import date

from django.test import TestCase

from .models import GuideArticle, GuideCategory


class PublicGuideTests(TestCase):
    def test_only_published_guides_in_active_categories_are_public(self):
        visible_category, _ = GuideCategory.objects.get_or_create(
            name="Admissions",
            defaults={"slug": "admissions-test"},
        )
        hidden_category = GuideCategory.objects.create(
            name="Hidden",
            slug="hidden-test",
            status=False,
        )
        GuideArticle.objects.create(
            slug="visible-guide-test",
            title="Visible guide",
            summary="Published content.",
            category=visible_category,
            updated_on=date(2026, 11, 1),
            reading_minutes=4,
            sections=[{"heading": "Start", "body": ["Published paragraph."]}],
            status=True,
        )
        GuideArticle.objects.create(
            slug="draft-guide-test",
            title="Draft guide",
            summary="Not public.",
            category=visible_category,
            updated_on=date(2026, 11, 1),
            reading_minutes=3,
            sections=[],
            status=False,
        )
        GuideArticle.objects.create(
            slug="hidden-category-guide-test",
            title="Hidden category guide",
            summary="Not public.",
            category=hidden_category,
            updated_on=date(2026, 11, 1),
            reading_minutes=2,
            sections=[],
            status=True,
        )

        response = self.client.get("/api/guides/articles/")

        self.assertEqual(response.status_code, 200)
        public_slugs = {row["slug"] for row in response.data["results"]}
        self.assertIn("visible-guide-test", public_slugs)
        self.assertNotIn("draft-guide-test", public_slugs)
        self.assertNotIn("hidden-category-guide-test", public_slugs)
        visible = next(
            row for row in response.data["results"] if row["slug"] == "visible-guide-test"
        )
        self.assertEqual(visible["category"], "Admissions")
