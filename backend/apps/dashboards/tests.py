from datetime import date

from django.contrib.auth import get_user_model
from django.http import QueryDict
from django.test import TestCase
from rest_framework.test import APIClient

from apps.fees.models import AcademicYear, FeeItem, FeeStructure
from apps.geography.models import City, Country, State
from apps.reviews.models import Review
from apps.schools.admin import ProfileGapFilter, SchoolAdmin
from apps.schools.completeness import build_profile_completion
from apps.schools.models import (
    Facility,
    Grade,
    School,
    SchoolAdmissionResource,
    SchoolContentChange,
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

    def test_school_admin_cannot_bypass_review_through_generic_facility_api(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.post(
            "/api/schools/school-facilities/",
            {
                "school": str(self.own.pk),
                "facility": str(self.facility.pk),
                "available": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(SchoolFacility.objects.filter(school=self.own).exists())
        self.assertFalse(SchoolContentChange.objects.filter(school=self.own).exists())

    def test_school_admin_can_submit_pre_nursery_and_nursery_together(self):
        pre_nursery = Grade.objects.create(
            grade_code="PN",
            grade_name="Pre Nursery",
            sort_order=900,
        )
        nursery = Grade.objects.create(
            grade_code="NUR",
            grade_name="Nursery",
            sort_order=901,
        )
        client = APIClient()
        client.force_authenticate(self.admin)

        response = client.post(
            "/api/dashboards/school/grades/",
            {
                "grades": [str(pre_nursery.pk), str(nursery.pk)],
                "seats_available": 12,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 202, response.data)
        self.assertEqual(len(response.data["submission_ids"]), 2)
        pending = SchoolContentChange.objects.filter(
            school=self.own,
            content_type=SchoolContentChange.TYPE_GRADE,
            status=SchoolContentChange.STATUS_PENDING,
        )
        self.assertEqual(pending.count(), 2)
        self.assertEqual(
            {change.payload["seats_available"] for change in pending},
            {12},
        )

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
        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.data["pending_review"])
        self.assertFalse(
            SchoolFacility.objects.filter(
                school=self.own, facility=self.facility
            ).exists()
        )
        pending = SchoolContentChange.objects.get(
            school=self.own,
            content_type=SchoolContentChange.TYPE_FACILITY,
            status=SchoolContentChange.STATUS_PENDING,
        )
        self.assertEqual(pending.payload["quantity_or_capacity"], 24)
        self.assertFalse(SchoolFacility.objects.filter(school=self.other, description="Two labs").exists())

    def test_super_admin_approval_publishes_staged_facility(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.post(
            "/api/dashboards/school/facilities/",
            {
                "facility": str(self.facility.pk),
                "available": True,
                "quantity_or_capacity": 24,
                "description": "Two labs",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 202)
        pending = SchoolContentChange.objects.get(school=self.own)

        reviewer = User.objects.create_user(
            username="school-content-reviewer",
            password="secret",
            role=User.ROLE_SUPER_ADMIN,
        )
        from apps.schools.content_changes import review_school_content_change

        review_school_content_change(
            pending.change_id,
            reviewer,
            approve=True,
            note="Approved.",
        )

        approved = SchoolFacility.objects.get(school=self.own, facility=self.facility)
        self.assertEqual(approved.quantity_or_capacity, 24)
        self.assertEqual(approved.description, "Two labs")

    def test_pending_and_rejected_facility_edits_keep_approved_values(self):
        approved = SchoolFacility.objects.create(
            school=self.own,
            facility=self.facility,
            available=True,
            quantity_or_capacity=10,
            description="Approved lab",
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.patch(
            f"/api/dashboards/school/facilities/{approved.pk}/",
            {"quantity_or_capacity": 24, "description": "Proposed lab"},
            format="json",
        )
        self.assertEqual(response.status_code, 202)
        approved.refresh_from_db()
        self.assertEqual(approved.quantity_or_capacity, 10)
        self.assertEqual(approved.description, "Approved lab")
        pending = SchoolContentChange.objects.get(
            school=self.own,
            content_type=SchoolContentChange.TYPE_FACILITY,
            status=SchoolContentChange.STATUS_PENDING,
        )
        reviewer = User.objects.create_user(
            username="school-content-rejector",
            password="secret",
            role=User.ROLE_SUPER_ADMIN,
        )
        from apps.schools.content_changes import review_school_content_change

        review_school_content_change(
            pending.change_id,
            reviewer,
            approve=False,
            note="Please correct the details.",
        )
        approved.refresh_from_db()
        self.assertEqual(approved.quantity_or_capacity, 10)
        self.assertEqual(approved.description, "Approved lab")
        dashboard = client.get("/api/dashboards/school/")
        self.assertEqual(
            dashboard.data["school"]["latest_content_change"]["status"],
            SchoolContentChange.STATUS_REJECTED,
        )
        self.assertEqual(
            dashboard.data["school"]["latest_content_change"]["review_note"],
            "Please correct the details.",
        )

    def test_fee_api_stages_add_update_and_publish_until_approval(self):
        year = AcademicYear.objects.create(
            year_code="2026-27-content",
            year_name="Academic Year 2026-27",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True,
            status=True,
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        added = client.post(
            "/api/dashboards/school/fees/items/",
            {
                "item_name": "Tuition",
                "item_category": "TUITION",
                "payment_frequency": "ANNUAL",
                "amount": "15000",
            },
            format="json",
        )
        self.assertEqual(added.status_code, 202, added.data)
        structure = FeeStructure.objects.get(school=self.own, academic_year=year)
        self.assertFalse(FeeItem.objects.filter(fee_structure=structure).exists())
        pending = SchoolContentChange.objects.get(
            school=self.own,
            content_type=SchoolContentChange.TYPE_FEE_ITEM,
            status=SchoolContentChange.STATUS_PENDING,
        )

        from apps.schools.content_changes import review_school_content_change

        reviewer = User.objects.create_user(
            username="fee-content-reviewer",
            password="secret",
            role=User.ROLE_SUPER_ADMIN,
        )
        review_school_content_change(pending.pk, reviewer, approve=True)
        item = FeeItem.objects.get(fee_structure=structure)

        updated = client.patch(
            f"/api/dashboards/school/fees/items/{item.pk}/",
            {"amount": "18000"},
            format="json",
        )
        self.assertEqual(updated.status_code, 202, updated.data)
        item.refresh_from_db()
        self.assertEqual(item.amount, 15000)
        pending = SchoolContentChange.objects.get(
            school=self.own,
            content_type=SchoolContentChange.TYPE_FEE_ITEM,
            status=SchoolContentChange.STATUS_PENDING,
        )
        review_school_content_change(pending.pk, reviewer, approve=True)
        item.refresh_from_db()
        self.assertEqual(item.amount, 18000)

        published = client.post(
            f"/api/dashboards/school/fees/{structure.pk}/publish/",
            {"published": True},
            format="json",
        )
        self.assertEqual(published.status_code, 202, published.data)
        structure.refresh_from_db()
        self.assertFalse(structure.published)
        pending = SchoolContentChange.objects.get(
            school=self.own,
            content_type=SchoolContentChange.TYPE_FEE_STRUCTURE,
            status=SchoolContentChange.STATUS_PENDING,
        )
        review_school_content_change(pending.pk, reviewer, approve=True)
        structure.refresh_from_db()
        self.assertTrue(structure.published)

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
        self.assertEqual(len(response.data["monthly_activity"]), 6)
        self.assertEqual(response.data["monthly_activity"][-1]["reviews"], 1)

    def test_school_activity_range_is_validated_and_returns_requested_months(self):
        client = APIClient()
        client.force_authenticate(self.admin)

        for months in (3, 6, 12):
            response = client.get(f"/api/dashboards/school/?months={months}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data["monthly_activity"]), months)

        invalid = client.get("/api/dashboards/school/?months=5")
        self.assertEqual(invalid.status_code, 400)

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
        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.data["pending_review"])
        self.assertFalse(
            SchoolAdmissionResource.objects.filter(
                school=self.own, title="Own school brochure"
            ).exists()
        )
        pending = SchoolContentChange.objects.get(
            school=self.own,
            content_type=SchoolContentChange.TYPE_RESOURCE,
            status=SchoolContentChange.STATUS_PENDING,
        )
        self.assertEqual(pending.payload["title"], "Own school brochure")

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
