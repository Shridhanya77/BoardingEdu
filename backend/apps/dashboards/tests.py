from django.contrib.auth import get_user_model
from django.http import QueryDict
from django.test import TestCase
from rest_framework.test import APIClient

from apps.geography.models import City, Country, State
from apps.reviews.models import Review
from apps.schools.admin import ProfileGapFilter, SchoolAdmin
from apps.schools.completeness import build_profile_completion
from apps.schools.models import (
    Facility,
    School,
    SchoolAdmissionResource,
    SchoolFacility,
    SchoolType,
)
from apps.users.models import SchoolAdminProfile

User = get_user_model()


class ProfileCompletionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = Country.objects.create(country_code="IN", country_name="India", slug="india-completion")
        cls.state = State.objects.create(
            country=cls.country, state_code="KA", state_name="Karnataka", slug="karnataka-completion"
        )
        cls.city = City.objects.create(
            state=cls.state, city_code="BLR", city_name="Bengaluru", slug="bengaluru-completion"
        )
        cls.day = SchoolType.objects.get(type_code="DAY")
        cls.school = School.objects.create(
            school_code="COMP1",
            school_name="Completion School",
            slug="completion-school",
            country=cls.country,
            state=cls.state,
            city=cls.city,
            address="Bengaluru",
            verification_status="PENDING",
        )
        cls.school.school_types.add(cls.day)

    def test_missing_fields_are_not_marked_published(self):
        report = build_profile_completion(self.school)
        about = next(
            item
            for section in report["sections"]
            if section["key"] == "basic"
            for item in section["items"]
            if item["key"] == "about"
        )
        self.assertEqual(about["status"], "missing")
        self.assertLess(report["score"], 100)

    def test_filled_pending_field_waits_for_approval(self):
        self.school.about = "A full description of the school."
        self.school.save(update_fields=["about"])
        report = build_profile_completion(self.school)
        about = next(
            item
            for section in report["sections"]
            if section["key"] == "basic"
            for item in section["items"]
            if item["key"] == "about"
        )
        self.assertEqual(about["status"], "awaiting_approval")

    def test_day_school_hostel_is_optional(self):
        report = build_profile_completion(self.school)
        hostel = next(
            item
            for section in report["sections"]
            if section["key"] == "hostel"
            for item in section["items"]
        )
        self.assertEqual(hostel["status"], "optional")


class SchoolAdminIsolationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        country = Country.objects.create(country_code="IN", country_name="India", slug="india-isolation")
        state = State.objects.create(country=country, state_code="MH", state_name="Maharashtra", slug="maharashtra-isolation")
        city = City.objects.create(state=state, city_code="PUN", city_name="Pune", slug="pune-isolation")
        cls.facility = Facility.objects.create(
            facility_code="LAB1",
            category="ACADEMIC",
            facility_name="Physics Lab",
            slug="physics-lab-isolation",
        )
        cls.own = School.objects.create(
            school_code="OWN1",
            school_name="Own School",
            slug="own-school",
            country=country,
            state=state,
            city=city,
            address="Pune",
            verification_status="VERIFIED",
            status=True,
        )
        cls.other = School.objects.create(
            school_code="OTH1",
            school_name="Other School",
            slug="other-school",
            country=country,
            state=state,
            city=city,
            address="Pune",
            verification_status="VERIFIED",
            status=True,
        )
        cls.other_facility = SchoolFacility.objects.create(school=cls.other, facility=cls.facility)
        user = User.objects.create_user(username="school-admin-own", password="secret", role=User.ROLE_SCHOOL_ADMIN)
        SchoolAdminProfile.objects.create(user=user, school=cls.own, designation="Principal")
        cls.admin = user
        cls.parent = User.objects.create_user(username="parent-isolation", password="secret", role=User.ROLE_PARENT)

    def test_parent_cannot_open_the_school_dashboard(self):
        client = APIClient()
        client.force_authenticate(self.parent)
        response = client.get("/api/dashboards/school/")
        self.assertEqual(response.status_code, 403)

    def test_school_admin_cannot_edit_another_schools_facility(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.delete(f"/api/dashboards/school/facilities/{self.other_facility.school_facility_id}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(SchoolFacility.objects.filter(pk=self.other_facility.pk).exists())

    def test_facility_write_ignores_a_client_supplied_school_id(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.post(
            "/api/dashboards/school/facilities/",
            {
                "facility": str(self.facility.pk),
                "school": str(self.other.pk),
                "quantity_or_capacity": 24,
                "description": "Two labs",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        created = SchoolFacility.objects.get(school=self.own, facility=self.facility)
        self.assertEqual(created.quantity_or_capacity, 24)
        self.assertFalse(SchoolFacility.objects.filter(school=self.other, description="Two labs").exists())

    def test_dashboard_lists_only_the_assigned_school(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        own_review = Review.objects.create(
            school=self.own,
            rating=5,
            title="Great school",
            body="A review for this school.",
            status=Review.STATUS_PUBLISHED,
        )
        Review.objects.create(
            school=self.other,
            rating=1,
            title="Another school",
            body="Must not appear in this dashboard.",
            status=Review.STATUS_PUBLISHED,
        )
        response = client.get("/api/dashboards/school/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["school"]["school_code"], "OWN1")
        self.assertIn("completion", response.data)
        self.assertEqual(
            [row["review_id"] for row in response.data["reviews"]],
            [str(own_review.review_id)],
        )

    def test_school_admin_can_add_brochure_link_but_cannot_manage_other_school_resources(self):
        resource = SchoolAdmissionResource.objects.create(
            school=self.other,
            resource_type=SchoolAdmissionResource.RESOURCE_BROCHURE,
            title="Other school brochure",
            document_url="https://documents.example.com/other.pdf",
        )
        client = APIClient()
        client.force_authenticate(self.admin)

        response = client.post(
            "/api/dashboards/school/admission-resources/",
            {
                "school": str(self.other.pk),
                "resource_type": SchoolAdmissionResource.RESOURCE_BROCHURE,
                "title": "Own school brochure",
                "document_url": "https://documents.example.com/own.pdf",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            SchoolAdmissionResource.objects.get(pk=response.data["resource_id"]).school,
            self.own,
        )

        denied = client.delete(
            f"/api/dashboards/school/admission-resources/{resource.resource_id}/"
        )
        self.assertEqual(denied.status_code, 404)
        self.assertTrue(SchoolAdmissionResource.objects.filter(pk=resource.pk).exists())


class ProfileGapFilterTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        country = Country.objects.create(country_code="IN", country_name="India", slug="india-gap")
        state = State.objects.create(country=country, state_code="TN", state_name="Tamil Nadu", slug="tamil-nadu-gap")
        city = City.objects.create(state=state, city_code="CHE", city_name="Chennai", slug="chennai-gap")
        cls.with_logo = School.objects.create(
            school_code="LOGO1",
            school_name="Logo School",
            slug="logo-school",
            country=country,
            state=state,
            city=city,
            address="Chennai",
            school_logo_url="https://cdn.example.com/logo.png",
        )
        cls.without_logo = School.objects.create(
            school_code="NOLOGO",
            school_name="No Logo School",
            slug="no-logo-school",
            country=country,
            state=state,
            city=city,
            address="Chennai",
        )

    def test_missing_logo_filter(self):
        params = QueryDict(mutable=True)
        params["profile_gap"] = "logo"
        gap_filter = ProfileGapFilter(None, params, School, SchoolAdmin)
        matches = set(gap_filter.queryset(None, School.objects.all()))
        self.assertIn(self.without_logo, matches)
        self.assertNotIn(self.with_logo, matches)
