from django.test import TestCase
from django.contrib import admin
from django.test import RequestFactory
from rest_framework.test import APIClient

from apps.geography.models import City, Country, State
from apps.schools.models import Board, School, SchoolType
from apps.users.models import SchoolAdminProfile, User

from .admin import ReviewAdmin
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
        self.assertEqual(response.data["status"], Review.STATUS_PENDING)
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

    def test_submitted_review_cannot_be_edited_or_deleted_by_parent(self):
        review = Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=4,
            status=Review.STATUS_APPROVED,
        )
        self.client.force_authenticate(self.parent)
        patch = self.client.patch(
            f"/api/reviews/{review.review_id}/",
            {"rating": 1, "body": "Changed"},
        )
        delete = self.client.delete(f"/api/reviews/{review.review_id}/")
        self.assertEqual(patch.status_code, 403)
        self.assertEqual(delete.status_code, 403)
        review.refresh_from_db()
        self.assertEqual(review.rating, 4)
        self.assertEqual(review.body, "")

    def test_only_super_admin_can_approve_or_reject_pending_reviews(self):
        review = Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=4,
            status=Review.STATUS_PENDING,
        )
        self.client.force_authenticate(self.parent)
        denied = self.client.post(f"/api/reviews/{review.review_id}/approve/")
        self.assertEqual(denied.status_code, 403)

        super_admin = User.objects.create_user(
            username="review-super-admin",
            password="testpass123",
            role=User.ROLE_SUPER_ADMIN,
        )
        self.client.force_authenticate(super_admin)
        approved = self.client.post(f"/api/reviews/{review.review_id}/approve/")
        self.assertEqual(approved.status_code, 200, approved.data)
        review.refresh_from_db()
        self.assertEqual(review.status, Review.STATUS_APPROVED)
        self.assertEqual(review.moderated_by, super_admin)
        self.assertIsNotNone(review.moderated_at)
        self.assertEqual(
            self.client.post(f"/api/reviews/{review.review_id}/reject/").status_code,
            409,
        )
        immutable = self.client.patch(
            f"/api/reviews/{review.review_id}/",
            {"rating": 1, "title": "Changed", "body": "Changed"},
        )
        self.assertEqual(immutable.status_code, 403)
        review.refresh_from_db()
        self.assertEqual(review.rating, 4)
        self.assertEqual(review.title, "")
        self.assertEqual(review.body, "")

        second = Review.objects.create(
            school=self.school,
            user=self.other_parent,
            rating=2,
            status=Review.STATUS_PENDING,
        )
        rejected = self.client.post(f"/api/reviews/{second.review_id}/reject/")
        self.assertEqual(rejected.status_code, 200, rejected.data)
        second.refresh_from_db()
        self.assertEqual(second.status, Review.STATUS_REJECTED)
        self.assertEqual(second.moderated_by, super_admin)
        self.assertIsNotNone(second.moderated_at)

    def test_school_admin_is_scoped_and_review_mutations_are_forbidden(self):
        other_school = School.objects.create(
            school_code="REV004",
            school_name="Other Review School",
            slug="other-review-school",
            country=self.country,
            state=self.state,
            city=self.city,
            address="Bengaluru",
        )
        own_review = Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=4,
            status=Review.STATUS_PENDING,
        )
        other_review = Review.objects.create(
            school=other_school,
            user=self.other_parent,
            rating=2,
            status=Review.STATUS_PENDING,
        )
        school_admin = User.objects.create_user(
            username="review-school-admin",
            password="testpass123",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        SchoolAdminProfile.objects.create(user=school_admin, school=self.school)
        self.client.force_authenticate(school_admin)

        response = self.client.get("/api/reviews/")
        self.assertEqual(response.status_code, 200)
        review_ids = {row["review_id"] for row in response.data["results"]}
        self.assertIn(str(own_review.review_id), review_ids)
        self.assertNotIn(str(other_review.review_id), review_ids)
        self.assertEqual(
            self.client.get(f"/api/reviews/{other_review.review_id}/").status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"/api/reviews/{own_review.review_id}/approve/").status_code,
            403,
        )
        self.assertEqual(
            self.client.post(f"/api/reviews/{own_review.review_id}/reject/").status_code,
            403,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/reviews/{own_review.review_id}/",
                {"status": "APPROVED", "rating": 1},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.put(
                f"/api/reviews/{own_review.review_id}/",
                {"status": "APPROVED", "rating": 1},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.delete(f"/api/reviews/{own_review.review_id}/").status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                "/api/reviews/summary/",
                {"school": str(other_school.school_id)},
            ).status_code,
            403,
        )
        own_review.refresh_from_db()
        self.assertEqual(own_review.status, Review.STATUS_PENDING)
        self.assertEqual(own_review.rating, 4)

    def test_review_creation_is_parent_only_and_status_is_server_controlled(self):
        school_admin = User.objects.create_user(
            username="review-create-school-admin",
            password="testpass123",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        self.client.force_authenticate(school_admin)
        response = self.client.post(
            "/api/reviews/",
            {
                "school": str(self.school.school_id),
                "rating": 5,
                "status": "APPROVED",
                "moderated_at": "2026-01-01T00:00:00Z",
            },
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Review.objects.count(), 0)

        self.client.force_authenticate(self.parent)
        response = self.client.post(
            "/api/reviews/",
            {
                "school": str(self.school.school_id),
                "rating": 5,
                "status": "APPROVED",
            },
        )
        self.assertEqual(response.status_code, 201, response.data)
        created = Review.objects.get()
        self.assertEqual(created.status, Review.STATUS_PENDING)
        self.assertIsNone(created.moderated_by)
        self.assertIsNone(created.moderated_at)

    def test_parent_can_view_own_pending_review_and_its_status(self):
        own_review = Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=4,
            status=Review.STATUS_PENDING,
        )
        Review.objects.create(
            school=self.school,
            user=self.other_parent,
            rating=2,
            status=Review.STATUS_PENDING,
        )
        self.client.force_authenticate(self.parent)
        response = self.client.get("/api/reviews/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [row["review_id"] for row in response.data["results"]],
            [str(own_review.review_id)],
        )
        self.assertEqual(response.data["results"][0]["status"], Review.STATUS_PENDING)

    def test_only_approved_reviews_are_public(self):
        approved = Review.objects.create(
            school=self.school,
            user=self.parent,
            rating=5,
            status=Review.STATUS_APPROVED,
        )
        Review.objects.create(
            school=self.school,
            user=self.other_parent,
            rating=1,
            status=Review.STATUS_PENDING,
        )
        response = self.client.get("/api/reviews/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [row["review_id"] for row in response.data["results"]],
            [str(approved.review_id)],
        )

    def test_review_admin_is_read_only_except_super_admin_moderation_actions(self):
        model_admin = ReviewAdmin(Review, admin.site)
        factory = RequestFactory()
        school_admin = User.objects.create_user(
            username="review-admin-school",
            password="testpass123",
            role=User.ROLE_SCHOOL_ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        SchoolAdminProfile.objects.create(user=school_admin, school=self.school)
        own_review = Review.objects.create(school=self.school, rating=5)
        other_review = Review.objects.create(school=self.boarding_school, rating=3)
        request = factory.get("/admin/reviews/review/")
        request.user = school_admin
        self.assertTrue(model_admin.has_view_permission(request))
        admin_review_ids = set(model_admin.get_queryset(request).values_list("pk", flat=True))
        self.assertEqual(admin_review_ids, {own_review.pk})
        self.assertFalse(model_admin.has_change_permission(request))
        self.assertFalse(model_admin.has_delete_permission(request))
        self.assertNotIn("approve_reviews", model_admin.get_actions(request))

        super_admin = User.objects.create_user(
            username="review-admin-super",
            password="testpass123",
            role=User.ROLE_SUPER_ADMIN,
            is_staff=True,
        )
        request.user = super_admin
        self.assertTrue(model_admin.has_view_permission(request))
        self.assertTrue(model_admin.has_change_permission(request))
        self.assertFalse(model_admin.has_delete_permission(request))
        self.assertIn("approve_reviews", model_admin.get_actions(request))
        self.assertIn("body", model_admin.readonly_fields)
        self.assertIn("rating", model_admin.readonly_fields)
        self.assertIn("status", model_admin.readonly_fields)

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
        self.assertIn(
            "Day Boarding School",
            response.data["results"][0]["school_type_names"],
        )
        self.assertEqual(summary.data["review_count"], 1)
