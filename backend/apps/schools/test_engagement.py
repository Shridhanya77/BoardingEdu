from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.geography.models import City, Country, State
from apps.reviews.models import Review
from apps.users.models import ParentProfile, User
from .engagement import recalculate_school_popularity
from .models import (
    School,
    SchoolEngagement,
    SchoolPopularity,
    SchoolPopularityConfig,
)


class SchoolEngagementTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        country = Country.objects.create(
            country_code="IN",
            country_name="India",
            slug="engagement-india",
        )
        state = State.objects.create(
            country=country,
            state_code="KA",
            state_name="Karnataka",
            slug="engagement-karnataka",
        )
        city = City.objects.create(
            state=state,
            city_code="BLR",
            city_name="Bengaluru",
            slug="engagement-bengaluru",
        )
        cls.school_a = School.objects.create(
            school_code="ENGAGEMENT-A",
            school_name="Engagement School A",
            slug="engagement-school-a",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            status=True,
            verification_status="VERIFIED",
        )
        cls.school_b = School.objects.create(
            school_code="ENGAGEMENT-B",
            school_name="Engagement School B",
            slug="engagement-school-b",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            status=True,
            verification_status="VERIFIED",
        )

    def test_public_events_dedupe_per_visitor_school_event_and_day(self):
        client = APIClient()
        payload = {
            "school_id": str(self.school_a.school_id),
            "event_type": SchoolEngagement.EVENT_SCHOOL_VIEW,
        }

        first = client.post("/api/schools/engagement/", payload, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["recorded"])
        visitor_token = first.cookies["be_visitor"].value

        repeated = client.post(
            "/api/schools/engagement/",
            payload,
            format="json",
            HTTP_COOKIE=f"be_visitor={visitor_token}",
        )
        self.assertEqual(repeated.status_code, 200)
        self.assertFalse(repeated.data["recorded"])
        self.assertEqual(
            SchoolEngagement.objects.filter(
                school=self.school_a,
                event_type=SchoolEngagement.EVENT_SCHOOL_VIEW,
            ).count(),
            1,
        )

        another_visitor = APIClient().post(
            "/api/schools/engagement/",
            payload,
            format="json",
        )
        self.assertEqual(another_visitor.status_code, 200)
        self.assertTrue(another_visitor.data["recorded"])
        self.assertEqual(
            SchoolEngagement.objects.filter(
                school=self.school_a,
                event_type=SchoolEngagement.EVENT_SCHOOL_VIEW,
            ).count(),
            2,
        )

    def test_popularity_aggregates_visitors_and_decays_older_events(self):
        now = timezone.now().replace(microsecond=0)
        config, _ = SchoolPopularityConfig.objects.get_or_create(config_id=1)
        config.rolling_window_days = 30
        config.half_life_days = 10
        config.quality_weight = 1
        config.review_saturation_count = 5
        config.save()

        for index in range(3):
            self._create_event(
                self.school_a,
                SchoolEngagement.EVENT_SCHOOL_VIEW,
                f"visitor-a-{index}",
                now,
            )
        self._create_event(
            self.school_a,
            SchoolEngagement.EVENT_SCHOOL_VIEW,
            "visitor-a-0",
            now - timedelta(days=5),
        )
        self._create_event(
            self.school_b,
            SchoolEngagement.EVENT_LISTING_CLICK,
            "visitor-b-click",
            now,
        )
        self._create_event(
            self.school_b,
            SchoolEngagement.EVENT_SCHOOL_VIEW,
            "visitor-b-view",
            now - timedelta(days=20),
        )

        self.assertEqual(recalculate_school_popularity(now=now), 2)

        popularity_a = SchoolPopularity.objects.get(school=self.school_a)
        popularity_b = SchoolPopularity.objects.get(school=self.school_b)
        self.assertEqual(popularity_a.unique_school_views, 3)
        self.assertAlmostEqual(float(popularity_a.engagement_score), 3, places=2)
        self.assertAlmostEqual(float(popularity_b.engagement_score), 2.25, places=2)
        self.assertGreater(popularity_a.popularity_score, popularity_b.popularity_score)

        response = APIClient().get("/api/schools/schools/popular/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data[0]["school_id"],
            str(self.school_a.school_id),
        )

    def test_verified_review_quality_contribution_is_capped(self):
        for _ in range(12):
            Review.objects.create(
                school=self.school_a,
                rating=5,
                status=Review.STATUS_PUBLISHED,
                is_verified=True,
            )

        recalculate_school_popularity()
        popularity = SchoolPopularity.objects.get(school=self.school_a)
        self.assertEqual(popularity.quality_score, 1)
        self.assertEqual(popularity.engagement_score, 0)

    def test_popular_endpoint_falls_back_to_verified_ratings_before_aggregation(self):
        Review.objects.create(
            school=self.school_a,
            rating=4,
            status=Review.STATUS_PUBLISHED,
            is_verified=True,
        )
        Review.objects.create(
            school=self.school_b,
            rating=5,
            status=Review.STATUS_PUBLISHED,
            is_verified=True,
        )

        response = APIClient().get("/api/schools/schools/popular/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data[0]["school_id"],
            str(self.school_b.school_id),
        )

    def test_shortlist_addition_is_recorded_only_on_first_save(self):
        parent = User.objects.create_user(
            username="engagement-parent",
            password="secret",
            role=User.ROLE_PARENT,
        )
        ParentProfile.objects.create(user=parent)
        client = APIClient()
        client.force_authenticate(parent)
        payload = {"school_id": str(self.school_a.school_id)}

        first = client.post(
            "/api/dashboards/parent/shortlist/",
            payload,
            format="json",
        )
        repeated = client.post(
            "/api/dashboards/parent/shortlist/",
            payload,
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(
            SchoolEngagement.objects.filter(
                school=self.school_a,
                event_type=SchoolEngagement.EVENT_SHORTLIST_ADD,
            ).count(),
            1,
        )

    def test_public_event_endpoint_rejects_non_public_schools_and_server_events(self):
        self.school_a.status = False
        self.school_a.save(update_fields=["status"])
        response = APIClient().post(
            "/api/schools/engagement/",
            {
                "school_id": str(self.school_a.school_id),
                "event_type": SchoolEngagement.EVENT_SCHOOL_VIEW,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 404)

        invalid_event = APIClient().post(
            "/api/schools/engagement/",
            {
                "school_id": str(self.school_b.school_id),
                "event_type": SchoolEngagement.EVENT_ENQUIRY_SUBMIT,
            },
            format="json",
        )
        self.assertEqual(invalid_event.status_code, 400)
        self.assertEqual(SchoolEngagement.objects.count(), 0)

    def test_admin_can_review_rankings_events_weights_and_scoring_settings(self):
        admin_user = User.objects.create_superuser(
            username="engagement-admin",
            email="engagement-admin@boardingedu.test",
            password="secret",
        )
        client = APIClient()
        client.force_login(admin_user)

        for route_name in (
            "admin:schools_schoolpopularity_changelist",
            "admin:schools_schoolengagement_changelist",
            "admin:schools_schoolengagementweight_changelist",
            "admin:schools_schoolpopularityconfig_change",
        ):
            args = [1] if route_name.endswith("_change") else None
            response = client.get(reverse(route_name, args=args))
            self.assertEqual(response.status_code, 200, route_name)

    def _create_event(self, school, event_type, identity_hash, occurred_at):
        SchoolEngagement.objects.create(
            school=school,
            event_type=event_type,
            identity_hash=identity_hash,
            dedupe_bucket=occurred_at.date(),
            occurred_at=occurred_at,
        )
