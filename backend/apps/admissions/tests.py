from rest_framework.test import APITestCase

from apps.geography.models import City, Country, State
from apps.schools.models import Board, Grade, SchoolType

from .models import CounsellingRequest


class CounsellingRequestApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = Country.objects.create(
            country_code="IN",
            country_name="India",
            slug="india",
        )
        cls.state = State.objects.create(
            country=cls.country,
            state_code="KA",
            state_name="Karnataka",
            slug="karnataka",
        )
        cls.city = City.objects.create(
            state=cls.state,
            city_code="BLR",
            city_name="Bengaluru",
            slug="bengaluru",
        )
        cls.grade = Grade.objects.create(
            grade_code="G6",
            grade_name="Grade 6",
            sort_order=6,
        )
        cls.board = Board.objects.create(
            board_code="CBSE",
            board_name="CBSE",
            slug="cbse",
        )
        cls.school_type = SchoolType.objects.get(
            type_code="DAY",
        )

    def get_payload(self):
        return {
            "parent_name": "Ananya Kamath",
            "email": "ananya@example.com",
            "phone": "+91 98765 43210",
            "preferred_country": str(self.country.pk),
            "preferred_state": str(self.state.pk),
            "preferred_cities": [str(self.city.pk)],
            "grades": [str(self.grade.pk)],
            "boards": [str(self.board.pk)],
            "school_types": [str(self.school_type.pk)],
            "message": "Looking for a suitable school.",
        }

    def test_public_submission_is_saved_with_multiple_relations(self):
        response = self.client.post(
            "/api/admissions/counselling-requests/",
            self.get_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        request = CounsellingRequest.objects.get(reference=response.data["reference"])
        self.assertEqual(request.parent_name, "Ananya Kamath")
        self.assertEqual(request.phone, "919876543210")
        self.assertEqual(list(request.preferred_cities.all()), [self.city])
        self.assertEqual(list(request.grades.all()), [self.grade])
        self.assertEqual(list(request.boards.all()), [self.board])
        self.assertEqual(list(request.school_types.all()), [self.school_type])

    def test_submission_rejects_unknown_grade_and_mismatched_city(self):
        invalid_grade = self.get_payload()
        invalid_grade["grades"] = ["00000000-0000-0000-0000-000000000000"]
        response = self.client.post(
            "/api/admissions/counselling-requests/",
            invalid_grade,
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("grades", response.data)

        invalid_city = self.get_payload()
        invalid_city["preferred_state"] = None
        invalid_city["preferred_country"] = "00000000-0000-0000-0000-000000000000"
        response = self.client.post(
            "/api/admissions/counselling-requests/",
            invalid_city,
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("preferred_country", response.data)
