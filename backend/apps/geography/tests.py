from django.test import TestCase

from apps.schools.models import School
from .models import City, Country, State
from .serializers import CityListSerializer


class CityListSerializerTests(TestCase):
    def test_city_payload_includes_school_count_and_seo_slugs(self):
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
        School.objects.create(
            school_code="LIVE",
            school_name="Live School",
            slug="live-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            status=True,
        )
        School.objects.create(
            school_code="INACTIVE",
            school_name="Inactive School",
            slug="inactive-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            status=False,
        )

        payload = CityListSerializer(city).data

        self.assertEqual(payload["schools_count"], 1)
        self.assertEqual(payload["country_slug"], "india")
        self.assertEqual(payload["state_slug"], "karnataka")
