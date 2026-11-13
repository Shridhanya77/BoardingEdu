from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.dashboards.models import RecentSchoolView
from apps.geography.models import City, Country, State
from apps.reviews.models import Review
from apps.schools.models import School
from apps.users.models import ParentProfile

User = get_user_model()


class PublicSummaryAndRecentSchoolTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        country = Country.objects.create(
            country_code="IN",
            country_name="India",
            slug="india-public-summary",
        )
        state = State.objects.create(
            country=country,
            state_code="DL",
            state_name="Delhi",
            slug="delhi-public-summary",
        )
        cls.city = City.objects.create(
            state=state,
            city_code="NDL",
            city_name="New Delhi",
            slug="new-delhi-public-summary",
        )
        cls.visible = School.objects.create(
            school_code="PUB-SUMMARY",
            school_name="Published School",
            slug="published-school-summary",
            country=country,
            state=state,
            city=cls.city,
            address="New Delhi",
            status=True,
            verification_status="VERIFIED",
            published_at=timezone.now(),
        )
        cls.hidden = School.objects.create(
            school_code="HIDDEN-SUMMARY",
            school_name="Pending School",
            slug="pending-school-summary",
            country=country,
            state=state,
            city=cls.city,
            address="New Delhi",
            status=True,
            verification_status="PENDING",
        )
        cls.parent_user = User.objects.create_user(
            username="recent-parent",
            password="secret",
            role=User.ROLE_PARENT,
        )
        cls.parent_profile = ParentProfile.objects.create(user=cls.parent_user)
        cls.other_user = User.objects.create_user(
            username="other-recent-parent",
            password="secret",
            role=User.ROLE_PARENT,
        )
        cls.other_profile = ParentProfile.objects.create(user=cls.other_user)

    def setUp(self):
        self.client = APIClient()

    def test_public_summary_counts_only_published_schools_and_reviews(self):
        verified_parent = User.objects.create_user(
            username="verified-review-parent",
            password="secret",
            role=User.ROLE_PARENT,
        )
        Review.objects.create(
            school=self.visible,
            user=verified_parent,
            rating=5,
            title="Published review",
            body="A public review.",
            status=Review.STATUS_PUBLISHED,
            is_verified=True,
        )
        Review.objects.create(
            school=self.visible,
            user=self.parent_user,
            rating=4,
            title="Unverified review",
            body="This review is not verified.",
            status=Review.STATUS_PUBLISHED,
        )
        Review.objects.create(
            school=self.hidden,
            user=verified_parent,
            rating=4,
            title="Pending school review",
            body="This school is not public.",
            status=Review.STATUS_PUBLISHED,
            is_verified=True,
        )

        response = self.client.get("/api/dashboards/public/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["schools_listed"], 1)
        self.assertEqual(response.data["cities_covered"], 1)
        self.assertEqual(response.data["published_reviews"], 1)
        self.assertIsNotNone(response.data["last_updated"])

    def test_public_school_directory_does_not_expose_unpublished_schools(self):
        response = self.client.get("/api/schools/schools/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [school["school_id"] for school in response.data["results"]],
            [str(self.visible.pk)],
        )

    def test_parent_recent_view_is_deduplicated_and_rejects_hidden_schools(self):
        self.client.force_authenticate(self.parent_user)
        path = "/api/dashboards/parent/recently-viewed/"
        accepted = self.client.post(path, {"school_id": str(self.visible.pk)}, format="json")
        repeated = self.client.post(path, {"school_id": str(self.visible.pk)}, format="json")
        hidden = self.client.post(path, {"school_id": str(self.hidden.pk)}, format="json")

        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(hidden.status_code, 404)
        self.assertEqual(
            RecentSchoolView.objects.filter(parent_profile=self.parent_profile).count(),
            1,
        )

    def test_parent_dashboard_only_returns_the_authenticated_parents_recent_schools(self):
        RecentSchoolView.objects.create(
            parent_profile=self.parent_profile,
            school=self.visible,
        )
        self.client.force_authenticate(self.other_user)

        response = self.client.get("/api/dashboards/parent/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["recently_viewed_schools"], [])

    def test_non_parent_cannot_write_recent_school_views(self):
        school_admin = User.objects.create_user(
            username="recent-school-admin",
            password="secret",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        self.client.force_authenticate(school_admin)

        response = self.client.post(
            "/api/dashboards/parent/recently-viewed/",
            {"school_id": str(self.visible.pk)},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
