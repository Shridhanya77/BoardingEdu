from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from django.test import TestCase

from apps.fees.models import AcademicYear
from apps.geography.models import City, Country, State
from apps.notifications.models import ParentNotification
from apps.schools.models import School
from apps.users.models import ParentProfile, SchoolAdminProfile, User

from .models import AdmissionEnquiry


class ApplicationTrackingTests(TestCase):
    def setUp(self):
        country = Country.objects.create(country_code="IN", country_name="India", slug="india-track")
        state = State.objects.create(country=country, state_code="KA", state_name="Karnataka", slug="karnataka-track")
        city = City.objects.create(state=state, city_code="BLR", city_name="Bengaluru", slug="bengaluru-track")
        self.year = AcademicYear.objects.create(
            year_code="2026-27-track",
            year_name="2026-27",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True,
            status=True,
        )
        self.school = School.objects.create(
            school_code="TRACK1",
            school_name="Tracking School",
            slug="tracking-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            phone="0800000000",
            email="admissions@tracking.example",
            website="https://tracking.example",
            verification_status="VERIFIED",
        )
        self.other = School.objects.create(
            school_code="TRACK2",
            school_name="Other Tracking School",
            slug="other-tracking-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            verification_status="VERIFIED",
        )
        self.parent = User.objects.create_user(
            username="track-parent",
            email="parent@tracking.example",
            password="secret-pass",
            role=User.ROLE_PARENT,
            first_name="Ada",
            last_name="Parent",
            phone="919876543210",
        )
        ParentProfile.objects.create(user=self.parent)
        self.other_parent = User.objects.create_user(
            username="other-track-parent",
            email="other@tracking.example",
            password="secret-pass",
            role=User.ROLE_PARENT,
        )
        ParentProfile.objects.create(user=self.other_parent)
        self.school_admin = User.objects.create_user(
            username="track-school",
            password="secret-pass",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        SchoolAdminProfile.objects.create(user=self.school_admin, school=self.school)
        self.parent_client = APIClient()
        self.parent_client.force_authenticate(self.parent)
        self.other_client = APIClient()
        self.other_client.force_authenticate(self.other_parent)
        self.school_client = APIClient()
        self.school_client.force_authenticate(self.school_admin)

    def _submit(self):
        return self.parent_client.post(
            "/api/admissions/enquiries/",
            {
                "school": str(self.school.school_id),
                "academic_year": str(self.year.academic_year_id),
                "message": "Please consider our application.",
                "child_name": "Asha",
            },
            format="json",
        )

    def test_enquiry_appears_once_and_starts_locked_to_the_parent(self):
        created = self._submit()
        self.assertEqual(created.status_code, 201, created.data)
        again = self._submit()
        self.assertEqual(again.status_code, 200, again.data)
        self.assertEqual(created.data["enquiry_id"], again.data["enquiry_id"])
        self.assertEqual(AdmissionEnquiry.objects.filter(parent_profile=self.parent.parent_profile).count(), 1)

        listing = self.parent_client.get("/api/admissions/applications/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data[0]["application_status"], "SUBMITTED")
        self.assertEqual(listing.data[0]["school"]["school_name"], "Tracking School")

        blocked = self.parent_client.patch(
            f"/api/admissions/enquiries/{created.data['enquiry_id']}/",
            {"status": "CONVERTED", "application_status": "OFFERED"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 200, blocked.data)
        enquiry = AdmissionEnquiry.objects.get(enquiry_id=created.data["enquiry_id"])
        self.assertEqual(enquiry.status, "NEW")
        self.assertEqual(enquiry.application_status, "SUBMITTED")

        hidden = self.other_client.get(f"/api/admissions/applications/{enquiry.enquiry_id}/")
        self.assertEqual(hidden.status_code, 404)

    def test_school_status_update_is_visible_on_the_parent_timeline(self):
        created = self._submit()
        enquiry_id = created.data["enquiry_id"]
        updated = self.school_client.post(
            f"/api/dashboards/school/enquiries/{enquiry_id}/status/",
            {
                "application_status": "DOCUMENTS_REQUIRED",
                "remarks": "Please share the birth certificate.",
                "instructions": "Upload a PDF.",
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        detail = self.parent_client.get(f"/api/admissions/applications/{enquiry_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["application_status"], "DOCUMENTS_REQUIRED")
        self.assertTrue(any(event["remarks"] == "Please share the birth certificate." for event in detail.data["timeline"]))
        self.assertTrue(ParentNotification.objects.filter(user=self.parent, enquiry_id=enquiry_id).exists())

        upload = self.parent_client.post(
            f"/api/admissions/applications/{enquiry_id}/documents/",
            {
                "document_type": "BIRTH_CERTIFICATE",
                "file": SimpleUploadedFile("birth.pdf", b"%PDF-1.4", content_type="application/pdf"),
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, 201, upload.data)
        rejected = self.parent_client.post(
            f"/api/admissions/applications/{enquiry_id}/documents/",
            {
                "document_type": "BIRTH_CERTIFICATE",
                "file": SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain"),
            },
            format="multipart",
        )
        self.assertEqual(rejected.status_code, 400)

        guest = APIClient()
        self.assertEqual(guest.get("/api/admissions/applications/").status_code, 401)
        self.assertIn("birth.pdf", upload.data["original_name"])
        self.assertNotIn("http", str(upload.data))
