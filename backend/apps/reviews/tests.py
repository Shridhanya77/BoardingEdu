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
        cls.board = Board.objects.create(
            board_code="REV-BOARD",
            board_name="Review Board",
            slug="review-board",
        )
        cls.school_type = SchoolType.objects.get(type_code="DAY")
        cls.boarding_school_type, _ = SchoolType.objects.get_or_create(
            type_code="FULL-BOARDING",
            defaults={"type_name": "Full Boarding", "slug": "full-boarding"},
        )
        cls.day_boarding_school_type, _ = SchoolType.objects.get_or_create(
            type_code="DAY-BOARDING",
            defaults={"type_name": "Day Boarding", "slug": "day-boarding"},
        )
        cls.school = School.objects.create(
            school_code="REV002",
            school_name="API Review School",
            slug="api-review-school",
            school_image_url="https://example.com/api-review-school.jpg",
            country=cls.country,
            state=cls.state,
            city=cls.city,
            address="Bengaluru",
        )
        cls.school.school_types.add(cls.school_type, cls.day_boarding_school_type)
        cls.school.boards.add(cls.board)
        cls.boarding_school = School.objects.create(
            school_code="REV003",
            school_name="Boarding Review School",
            slug="boarding-review-school",
            country=cls.country,
            state=cls.state,
            city=cls.city,
            address="Bengaluru",
        )
        cls.boarding_school.school_types.add(cls.boarding_school_type)
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
                "academics_rating": 4,
                "facilities_rating": 5,
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
        self.assertEqual(review.academics_rating, 4)
        self.assertEqual(review.facilities_rating, 5)

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
            school=self.school,
            user=self.parent,
            rating=5,
            academics_rating=5,
            facilities_rating=4,
            status=Review.STATUS_PUBLISHED,
        )
        Review.objects.create(
            school=self.school,
            user=self.other_parent,
            rating=3,
            academics_rating=3,
            safety_rating=4,
            status=Review.STATUS_PUBLISHED,
        )
        response = self.client.get(
            "/api/reviews/summary/", {"school": str(self.school.school_id)}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["review_count"], 2)
        self.assertEqual(response.data["average_rating"], 4.0)
        self.assertEqual(response.data["distribution"]["5"], 1)
        self.assertEqual(response.data["category_ratings"]["academics_rating"], {
            "average": 4.0,
            "count": 2,
        })
        self.assertEqual(response.data["category_ratings"]["facilities_rating"], {
            "average": 4.0,
            "count": 1,
        })
        self.assertEqual(response.data["category_ratings"]["safety_rating"], {
            "average": 4.0,
            "count": 1,
        })

    def test_summary_requires_school_param(self):
        response = self.client.get("/api/reviews/summary/")
        self.assertEqual(response.status_code, 400)

    def test_public_summary_aggregates_only_published_reviews(self):
        Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=5,
            status=Review.STATUS_PUBLISHED,
        )
        Review.objects.create(
            school=self.school,
            user=self.other_parent,
            rating=3,
            status=Review.STATUS_PUBLISHED,
        )
        Review.objects.create(
            school=self.school,
            rating=1,
            status=Review.STATUS_PENDING,
        )
        response = self.client.get("/api/reviews/public-summary/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["review_count"], 2)
        self.assertEqual(response.data["average_rating"], 4.0)
        self.assertEqual(response.data["distribution"]["5"], 1)
        self.assertEqual(response.data["distribution"]["3"], 1)
        self.assertEqual(response.data["distribution"]["1"], 0)

    def test_reviews_and_public_summary_filter_by_school_type(self):
        Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=5,
            status=Review.STATUS_PUBLISHED,
        )
        Review.objects.create(
            school=self.boarding_school,
            user=self.other_parent,
            rating=3,
            status=Review.STATUS_PUBLISHED,
        )

        params = {"school_type": str(self.boarding_school_type.pk)}
        response = self.client.get("/api/reviews/", params)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["school_name"], "Boarding Review School")

        summary = self.client.get("/api/reviews/public-summary/", params)
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["review_count"], 1)
        self.assertEqual(summary.data["average_rating"], 3.0)
        self.assertEqual(summary.data["distribution"]["3"], 1)

        day_params = {
            "school_type": [
                str(self.school_type.pk),
                str(self.day_boarding_school_type.pk),
            ]
        }
        day_reviews = self.client.get("/api/reviews/", day_params)
        self.assertEqual(len(day_reviews.data["results"]), 1)
        self.assertEqual(day_reviews.data["results"][0]["school_name"], "API Review School")
        self.assertEqual(
            day_reviews.data["results"][0]["school_image_url"],
            "https://example.com/api-review-school.jpg",
        )
        self.assertEqual(day_reviews.data["results"][0]["school_city_name"], "Bengaluru")
        day_summary = self.client.get("/api/reviews/public-summary/", day_params)
        self.assertEqual(day_summary.data["review_count"], 1)

    def test_reviews_and_public_summary_filter_by_location_and_board(self):
        Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=5,
            status=Review.STATUS_PUBLISHED,
        )
        Review.objects.create(
            school=self.boarding_school,
            user=self.other_parent,
            rating=3,
            status=Review.STATUS_PUBLISHED,
        )

        params = {
            "state": str(self.state.pk),
            "city": str(self.city.pk),
            "board": str(self.board.pk),
        }
        response = self.client.get("/api/reviews/", params)
        summary = self.client.get("/api/reviews/public-summary/", params)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["school_name"], "API Review School")
        self.assertEqual(response.data["results"][0]["school_city_slug"], "bengaluru")
        self.assertEqual(summary.data["review_count"], 1)
