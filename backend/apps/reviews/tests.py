from django.test import TestCase
from rest_framework.test import APIClient

from apps.geography.models import City, Country, State
from apps.schools.models import Board, School, SchoolType
from apps.users.models import User

from .models import Review


class ReviewModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = Country.objects.create(
            country_code="IN", country_name="India", slug="india"
        )
        cls.state = State.objects.create(
            country=cls.country,
            state_code="KA",
            state_name="Karnataka",
            slug="karnataka",
        )
        cls.city = City.objects.create(
            state=cls.state, city_code="BLR", city_name="Bengaluru", slug="bengaluru"
        )
        cls.board = Board.objects.create(board_code="CBSE", board_name="CBSE", slug="cbse")
        cls.school_type = SchoolType.objects.get(type_code="DAY")
        cls.school = School.objects.create(
            school_code="REV001",
            school_name="Review Test School",
            slug="review-test-school",
            country=cls.country,
            state=cls.state,
            city=cls.city,
            address="Bengaluru",
        )
        cls.school.boards.add(cls.board)
        cls.school.school_types.add(cls.school_type)
        cls.parent = User.objects.create_user(
            username="parent1", password="testpass123", role=User.ROLE_PARENT
        )

    def test_review_display_name_defaults_to_username(self):
        review = Review.objects.create(
            school=self.school, user=self.parent, rating=5
        )
        self.assertEqual(review.display_name, "parent1")

    def test_unique_review_per_school_and_user(self):
        Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=4,
            status=Review.STATUS_PUBLISHED,
        )
        with self.assertRaises(Exception):
            Review.objects.create(school=self.school, user=self.parent, rating=3)


class ReviewApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = Country.objects.create(
            country_code="IN", country_name="India", slug="india"
        )
        cls.state = State.objects.create(
            country=cls.country,
            state_code="KA",
            state_name="Karnataka",
            slug="karnataka",
        )
        cls.city = City.objects.create(
            state=cls.state, city_code="BLR", city_name="Bengaluru", slug="bengaluru"
        )
        cls.school_type = SchoolType.objects.get(type_code="DAY")
        cls.school = School.objects.create(
            school_code="REV002",
            school_name="API Review School",
            slug="api-review-school",
            country=cls.country,
            state=cls.state,
            city=cls.city,
            address="Bengaluru",
        )
        cls.school.school_types.add(cls.school_type)
        cls.parent = User.objects.create_user(
            username="parent2", password="testpass123", role=User.ROLE_PARENT
        )
        cls.other_parent = User.objects.create_user(
            username="parent3", password="testpass123", role=User.ROLE_PARENT
        )

    def setUp(self):
        self.client = APIClient()

    def test_anonymous_can_only_see_published_reviews(self):
        Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=5,
            status=Review.STATUS_PUBLISHED,
        )
        Review.objects.create(
            school=self.school,
            user=self.other_parent,
            rating=1,
            status=Review.STATUS_PENDING,
        )
        response = self.client.get("/api/reviews/")
        self.assertEqual(response.status_code, 200)
        results = response.data["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["rating"], 5)

    def test_authenticated_parent_can_create_review(self):
        self.client.force_authenticate(self.parent)
        response = self.client.post(
            "/api/reviews/",
            {
                "school": str(self.school.school_id),
                "rating": 5,
                "title": "Great school",
                "body": "Loved the campus.",
            },
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Review.objects.count(), 1)
        review = Review.objects.get()
        self.assertEqual(review.user, self.parent)
        self.assertEqual(review.status, Review.STATUS_PENDING)
        self.assertEqual(review.author_name, "parent2")

    def test_duplicate_review_for_same_school_is_rejected(self):
        Review.objects.create(
            school=self.school, user=self.parent, rating=4, status=Review.STATUS_PUBLISHED
        )
        self.client.force_authenticate(self.parent)
        response = self.client.post(
            "/api/reviews/",
            {"school": str(self.school.school_id), "rating": 5},
        )
        self.assertEqual(response.status_code, 400)

    def test_only_owner_can_delete_review(self):
        review = Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=4,
            status=Review.STATUS_PUBLISHED,
        )
        self.client.force_authenticate(self.other_parent)
        denied = self.client.delete(f"/api/reviews/{review.review_id}/")
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.parent)
        allowed = self.client.delete(f"/api/reviews/{review.review_id}/")
        self.assertEqual(allowed.status_code, 204)

    def test_summary_aggregates_published_reviews(self):
        Review.objects.create(
            school=self.school, user=self.parent, rating=5, status=Review.STATUS_PUBLISHED
        )
        Review.objects.create(
            school=self.school,
            user=self.other_parent,
            rating=3,
            status=Review.STATUS_PUBLISHED,
        )
        response = self.client.get(
            "/api/reviews/summary/", {"school": str(self.school.school_id)}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["review_count"], 2)
        self.assertEqual(response.data["average_rating"], 4.0)
        self.assertEqual(response.data["distribution"]["5"], 1)

    def test_summary_requires_school_param(self):
        response = self.client.get("/api/reviews/summary/")
        self.assertEqual(response.status_code, 400)
