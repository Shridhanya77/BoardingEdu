from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.geography.models import City, Country, State
from apps.schools.models import School, SchoolType


class SchoolSuggestionTests(TestCase):
    def create_school(self, code, name, slug):
        country = Country.objects.create(
            country_code=f"{code[:4]}{code[-1]}",
            country_name="India",
            slug=f"india-{code.lower()}",
        )
        state = State.objects.create(
            country=country,
            state_code=f"{code[:2]}",
            state_name="Karnataka",
            slug=f"karnataka-{code.lower()}",
        )
        city = City.objects.create(
            state=state,
            city_code=f"{code[:3]}",
            city_name="Bengaluru",
            slug=f"bengaluru-{code.lower()}",
        )
        return School.objects.create(
            school_code=code,
            school_name=name,
            slug=slug,
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
        )

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

    @patch("apps.search.views.search_school_ids")
    def test_suggestions_keep_meilisearch_relevance_order(self, search_school_ids):
        first = self.create_school("ORDER001", "School One", "school-one")
        second = self.create_school("ORDER002", "School Two", "school-two")
        search_school_ids.return_value = [str(second.pk), str(first.pk)]

        response = APIClient().get("/api/search/suggestions/?q=School")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [school["school_id"] for school in response.data["schools"]],
            [str(second.pk), str(first.pk)],
        )
        search_school_ids.assert_called_once_with("School", 8)

    @patch("apps.search.views.search_school_ids", return_value=None)
    def test_suggestions_fall_back_to_database_when_meilisearch_is_unavailable(
        self, search_school_ids
    ):
        school = self.create_school("FALLBACK001", "Fallback School", "fallback-school")

        response = APIClient().get("/api/search/suggestions/?q=Fallback")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["school_id"] for item in response.data["schools"]],
            [str(school.pk)],
        )
