from django.test import TestCase
from rest_framework.test import APIClient

from apps.geography.models import City, Country, State
from apps.schools.models import School, SchoolType


class SchoolSuggestionTests(TestCase):
    def test_suggestions_return_all_school_types_for_canonical_profile_urls(self):
        country = Country.objects.create(
            country_code="IN",
            country_name="India",
            slug="india",
        )
        state = State.objects.create(
            country=country,
            state_code="KA",
            state_name="Karnataka",
            slug="karnataka",
        )
        city = City.objects.create(
            state=state,
            city_code="BLR",
            city_name="Bengaluru",
            slug="bengaluru",
        )
        school = School.objects.create(
            school_code="SEARCH001",
            school_name="Boarding Search School",
            slug="boarding-search-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
        )
        boarding_type, _ = SchoolType.objects.get_or_create(
            type_code="FULL-BOARDING",
            defaults={"type_name": "Full Boarding", "slug": "full-boarding"},
        )
        school.school_types.add(
            SchoolType.objects.get(type_code="DAY"),
            boarding_type,
        )

        response = APIClient().get("/api/search/suggestions/?q=Boarding")

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(
            response.data["schools"][0]["school_type_names"],
            ["Day School", "Full Boarding"],
        )
