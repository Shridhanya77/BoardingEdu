from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.contrib import admin
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.admissions.models import AdmissionEnquiry
from apps.fees.models import AcademicYear, FeeItem, FeeStructure
from apps.geography.models import City, Country, State
from apps.notifications.models import EmailDelivery
from apps.schools.admin import SchoolAdmin
from apps.schools.models import Facility, School, SchoolFacility, SchoolProfileChange
from apps.subscriptions.models import (
    SchoolSubscription,
    SubscriptionPayment,
    SubscriptionPlan,
)
from apps.users.models import SchoolAdminProfile, User

from .serializers import UserRegisterSerializer


class UserRegistrationContactValidationTests(SimpleTestCase):
    def test_phone_requires_country_code_and_exactly_ten_digits(self):
        serializer = UserRegisterSerializer()

        self.assertEqual(
            serializer.fields["phone"].run_validation("+91 98765 43210"),
            "+91 98765 43210",
        )
        with self.assertRaises(ValidationError):
            serializer.validate_phone("9876543210")

        with self.assertRaises(ValidationError):
            serializer.validate_phone("+91 98765 4321099")

        self.assertEqual(
            serializer.validate_phone("+91 98765 43210"),
            "919876543210",
        )


class PendingSchoolAdminLoginTests(TestCase):
    def test_pending_school_admin_can_sign_in_to_the_website_panel(self):
        country = Country.objects.create(country_code="IN", country_name="India", slug="india-login")
        state = State.objects.create(
            country=country, state_code="KA", state_name="Karnataka", slug="karnataka-login"
        )
        city = City.objects.create(state=state, city_code="BLR", city_name="Bengaluru", slug="bengaluru-login")
        school = School.objects.create(
            school_code="LOGIN1",
            school_name="Pending Login School",
            slug="pending-login-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            verification_status="PENDING",
            status=False,
        )
        User.objects.create_user(
            username="pending-school-admin",
            password="secret-pass",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        admin = User.objects.get(username="pending-school-admin")
        SchoolAdminProfile.objects.create(user=admin, school=school, designation="Principal")

        from unittest.mock import patch

        from django.test import override_settings

        with override_settings(
            OTP_BACKEND="memory",
            CLOUDFLARE_EMAIL_API_TOKEN="test-token",
            CLOUDFLARE_EMAIL_ACCOUNT_ID="test-account",
            CLOUDFLARE_EMAIL_FROM="no-reply@boardingedu.com",
        ), patch("apps.notifications.otp.generate_code", return_value="123456"), patch(
            "apps.notifications.email_provider.requests.post"
        ) as send:
            send.return_value.status_code = 200
            send.return_value.ok = True
            send.return_value.json.return_value = {
                "success": True,
                "result": {"delivered": ["pending-school-admin has no email"], "queued": [], "message_id": "cf-1"},
            }
            admin.email = "pending-admin@example.test"
            admin.save(update_fields=["email"])
            send.return_value.json.return_value["result"]["delivered"] = [admin.email]
            challenge = APIClient().post(
                "/api/auth/jwt/token/",
                {"username": "pending-school-admin", "password": "secret-pass"},
                format="json",
            )
            self.assertEqual(challenge.status_code, 200, challenge.data)
            self.assertTrue(challenge.data.get("otp_required"))
            self.assertNotIn("access", challenge.data)
            response = APIClient().post(
                "/api/auth/otp/verify/",
                {"email": admin.email, "otp": "123456", "purpose": "login"},
                format="json",
            )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("access", response.data)
        refreshed = APIClient().post(
            "/api/auth/jwt/token/refresh/",
            {"refresh": response.data["refresh"]},
            format="json",
        )
        self.assertEqual(refreshed.status_code, 200, refreshed.data)
        self.assertIn("access", refreshed.data)


class SchoolAdminBackendLoginTests(TestCase):
    def test_school_admin_enters_django_admin_for_their_school_only(self):
        country = Country.objects.create(country_code="IN", country_name="India", slug="india-backend-admin")
        state = State.objects.create(
            country=country, state_code="KA", state_name="Karnataka", slug="karnataka-backend-admin"
        )
        city = City.objects.create(
            state=state, city_code="BLR", city_name="Bengaluru", slug="bengaluru-backend-admin"
        )
        own = School.objects.create(
            school_code="OWN-ADMIN",
            school_name="Own Admin School",
            slug="own-admin-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            verification_status="PENDING",
        )
        other = School.objects.create(
            school_code="OTHER-ADMIN",
            school_name="Other Admin School",
            slug="other-admin-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
        )
        user = User.objects.create_user(
            username="backend-school-admin",
            email="principal@own-admin.test",
            password="secret-pass",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        SchoolAdminProfile.objects.create(user=user, school=own, designation="Principal")
        reviewer = User.objects.create_user(
            username="workspace-superadmin",
            password="secret-pass",
            role=User.ROLE_SUPER_ADMIN,
            is_staff=True,
        )
        parent = User.objects.create_user(
            username="backend-parent",
            email="parent@own-admin.test",
            password="secret-pass",
            role=User.ROLE_PARENT,
        )
        client = APIClient()

        rejected = client.post(
            "/admin/login/",
            {"username": parent.username, "password": "secret-pass"},
        )
        self.assertEqual(rejected.status_code, 200)
        self.assertContains(rejected, "Please enter the correct")

        for identifier in (user.username, user.email):
            client.logout()
            signed_in = client.post(
                "/admin/login/",
                {"username": identifier, "password": "secret-pass", "next": "/admin/"},
            )
            self.assertEqual(signed_in.status_code, 302, identifier)
            self.assertEqual(signed_in.url, "/admin/")

        year = AcademicYear.objects.create(
            year_code="2026-27-admin",
            year_name="Academic Year 2026-27",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
        )
        own_lead = AdmissionEnquiry.objects.create(
            school=own,
            academic_year=year,
            guest_full_name="Visible Parent",
            guest_phone="919876543210",
            guest_email="visible-parent@example.test",
            guest_child_name="Private Child",
        )
        AdmissionEnquiry.objects.create(
            school=other,
            academic_year=year,
            guest_full_name="Hidden Parent",
            guest_phone="919000000000",
        )
        from apps.reviews.models import Review
        from apps.schools.models import SchoolAdmissionResource, SchoolContentChange, SchoolPhoto
        from apps.schools.content_changes import review_school_content_change

        def approve_latest_content_change():
            pending_change = SchoolContentChange.objects.filter(
                school=own,
                status=SchoolContentChange.STATUS_PENDING,
            ).latest("submitted_at")
            return review_school_content_change(
                pending_change.pk,
                reviewer,
                approve=True,
                note="Approved in test.",
            )

        brochure = SchoolAdmissionResource.objects.create(
            school=own,
            resource_type=SchoolAdmissionResource.RESOURCE_BROCHURE,
            title="Own school brochure",
            document_url="https://files.example.test/own-brochure.pdf",
        )
        photo = SchoolPhoto.objects.create(
            school=own,
            photo_url="https://files.example.test/own-campus.webp",
            caption="Own campus",
        )
        review = Review.objects.create(
            school=own,
            author_name="Own school reviewer",
            rating=4,
            title="Own school review",
            body="A detailed school review.",
            status=Review.STATUS_PENDING,
        )

        home = client.get("/admin/")
        self.assertEqual(home.status_code, 302)
        self.assertEqual(home.url, reverse("admin:school_workspace"))
        workspace = client.get(home.url, follow=True)
        self.assertEqual(workspace.status_code, 200)
        self.assertContains(workspace, 'id="jazzy-sidebar"')
        self.assertContains(workspace, 'id="jazzy-navigation"')
        self.assertContains(workspace, "Own Admin School")
        self.assertContains(workspace, own_lead.enquiry_code)
        self.assertNotContains(workspace, "Visible Parent")
        self.assertNotContains(workspace, "919876543210")
        self.assertNotContains(workspace, "visible-parent@example.test")
        self.assertNotContains(workspace, "Private Child")
        self.assertContains(workspace, "Subscription required")
        self.assertNotContains(workspace, "Other Admin School")
        self.assertNotContains(workspace, "Hidden Parent")
        self.assertContains(workspace, "Your school")
        self.assertContains(workspace, "Facilities")
        self.assertContains(workspace, "Subscription plans")
        self.assertNotContains(workspace, "Countries")
        self.assertContains(workspace, f"/school-workspace/{own.slug}/facilities/academic/")
        self.assertContains(workspace, f"/school-workspace/{own.slug}/grades/early/")
        self.assertContains(workspace, f"/school-workspace/{own.slug}/documents/")
        self.assertContains(workspace, f"/school-workspace/{own.slug}/reviews/")

        workspace_url = reverse(
            "admin:school_workspace_section",
            kwargs={"school_slug": own.slug, "section_slug": "overview"},
        )
        facilities_url = reverse(
            "admin:school_workspace_subsection",
            kwargs={
                "school_slug": own.slug,
                "section_slug": "facilities",
                "subsection_slug": "academic",
            },
        )
        grades_url = reverse(
            "admin:school_workspace_subsection",
            kwargs={
                "school_slug": own.slug,
                "section_slug": "grades",
                "subsection_slug": "early",
            },
        )
        fees_url = reverse(
            "admin:school_workspace_section",
            kwargs={"school_slug": own.slug, "section_slug": "fees"},
        )
        documents_url = reverse(
            "admin:school_workspace_section",
            kwargs={"school_slug": own.slug, "section_slug": "documents"},
        )
        facilities_page = client.get(facilities_url)
        self.assertEqual(facilities_page.status_code, 200)
        self.assertContains(facilities_page, 'id="facilities"')
        self.assertContains(facilities_page, "Classrooms")
        self.assertNotContains(facilities_page, 'id="grades"')
        grades_page = client.get(grades_url)
        self.assertEqual(grades_page.status_code, 200)
        self.assertContains(grades_page, 'id="grades"')
        self.assertContains(grades_page, "Grade levels")
        self.assertNotContains(grades_page, 'id="facilities"')

        fees_page = client.get(fees_url)
        self.assertEqual(fees_page.status_code, 200)
        self.assertContains(fees_page, 'id="fees"')
        self.assertContains(fees_page, "Add fee")
        self.assertContains(fees_page, "Academic year")
        fee_add = client.post(
            fees_url,
            {
                "fee_action": "add",
                "academic_year": str(year.pk),
                "item_name": "Tuition fee",
                "item_category": "TUITION",
                "payment_frequency": "ANNUAL",
                "amount": "12000.00",
            },
        )
        self.assertEqual(fee_add.status_code, 302)
        own_structure = FeeStructure.objects.get(school=own, academic_year=year)
        self.assertFalse(FeeItem.objects.filter(fee_structure=own_structure).exists())
        approve_latest_content_change()
        own_fee = FeeItem.objects.get(fee_structure=own_structure)
        self.assertEqual(own_fee.amount, 12000)
        self.assertFalse(own_structure.published)
        rejected_fee = client.post(
            fees_url,
            {
                "fee_action": "add",
                "academic_year": str(year.pk),
                "item_name": "Negative fee",
                "item_category": "TUITION",
                "payment_frequency": "ANNUAL",
                "amount": "-1",
            },
        )
        self.assertEqual(rejected_fee.status_code, 302)
        self.assertFalse(FeeItem.objects.filter(item_name="Negative fee").exists())

        fee_update = client.post(
            fees_url,
            {
                "fee_action": "update",
                "fee_item_id": str(own_fee.pk),
                "item_name": "Annual tuition",
                "amount": "15000.00",
            },
        )
        self.assertEqual(fee_update.status_code, 302)
        own_fee.refresh_from_db()
        self.assertEqual(own_fee.item_name, "Tuition fee")
        self.assertEqual(own_fee.amount, 12000)
        approve_latest_content_change()
        own_fee.refresh_from_db()
        self.assertEqual(own_fee.item_name, "Annual tuition")
        self.assertEqual(own_fee.amount, 15000)

        fee_publish = client.post(
            fees_url,
            {"fee_action": "publish", "fee_structure_id": str(own_structure.pk)},
        )
        self.assertEqual(fee_publish.status_code, 302)
        own_structure.refresh_from_db()
        self.assertFalse(own_structure.published)
        approve_latest_content_change()
        own_structure.refresh_from_db()
        self.assertTrue(own_structure.published)
        fee_unpublish = client.post(
            fees_url,
            {"fee_action": "unpublish", "fee_structure_id": str(own_structure.pk)},
        )
        self.assertEqual(fee_unpublish.status_code, 302)
        own_structure.refresh_from_db()
        self.assertTrue(own_structure.published)
        approve_latest_content_change()
        own_structure.refresh_from_db()
        self.assertFalse(own_structure.published)

        other_structure = FeeStructure.objects.create(
            structure_code="OTHER-FEES-2026",
            structure_name="Other school fees",
            school=other,
            academic_year=year,
            effective_from=year.start_date,
        )
        foreign_fee = FeeItem.objects.create(
            fee_structure=other_structure,
            item_code="OTHER-TUITION",
            item_name="Other school's tuition",
            payment_frequency="ANNUAL",
            amount="20000.00",
        )
        foreign_fee_delete = client.post(
            fees_url,
            {"fee_action": "delete", "fee_item_id": str(foreign_fee.pk)},
        )
        self.assertEqual(foreign_fee_delete.status_code, 302)
        self.assertTrue(FeeItem.objects.filter(pk=foreign_fee.pk).exists())

        fee_delete = client.post(
            fees_url,
            {"fee_action": "delete", "fee_item_id": str(own_fee.pk)},
        )
        self.assertEqual(fee_delete.status_code, 302)
        self.assertTrue(FeeItem.objects.filter(pk=own_fee.pk).exists())
        approve_latest_content_change()
        self.assertFalse(FeeItem.objects.filter(pk=own_fee.pk).exists())

        photographs_page = client.get(
            reverse(
                "admin:school_workspace_section",
                kwargs={"school_slug": own.slug, "section_slug": "photographs"},
            )
        )
        self.assertContains(photographs_page, photo.photo_url)
        self.assertContains(photographs_page, "Own campus")

        documents_page = client.get(documents_url)
        self.assertContains(documents_page, brochure.title)
        added_document = client.post(
            documents_url,
            {
                "resource_action": "add",
                "resource_type": SchoolAdmissionResource.RESOURCE_REQUIRED_DOCUMENT,
                "title": "Birth certificate",
                "description": "Required for admission",
                "document_url": "https://files.example.test/birth-certificate.pdf",
            },
        )
        self.assertEqual(added_document.status_code, 302)
        self.assertFalse(
            SchoolAdmissionResource.objects.filter(
                school=own, title="Birth certificate"
            ).exists()
        )
        approve_latest_content_change()
        self.assertTrue(
            SchoolAdmissionResource.objects.filter(
                school=own,
                title="Birth certificate",
                status=True,
            ).exists()
        )
        from django.core.files.uploadedfile import SimpleUploadedFile

        rejected_upload = client.post(
            documents_url,
            {
                "resource_action": "add",
                "resource_type": SchoolAdmissionResource.RESOURCE_BROCHURE,
                "title": "Invalid brochure",
                "file": SimpleUploadedFile("brochure.pdf", b"not a PDF", content_type="application/pdf"),
            },
        )
        self.assertEqual(rejected_upload.status_code, 302)
        self.assertFalse(
            SchoolAdmissionResource.objects.filter(school=own, title="Invalid brochure").exists()
        )
        removed_document = client.post(
            documents_url,
            {"resource_action": "remove", "resource_id": str(brochure.pk)},
        )
        self.assertEqual(removed_document.status_code, 302)
        brochure.refresh_from_db()
        self.assertTrue(brochure.status)
        approve_latest_content_change()
        brochure.refresh_from_db()
        self.assertFalse(brochure.status)

        reviews_page = client.get(
            reverse(
                "admin:school_workspace_section",
                kwargs={"school_slug": own.slug, "section_slug": "reviews"},
            )
        )
        self.assertContains(reviews_page, review.title)
        self.assertContains(reviews_page, review.body)
        self.assertContains(reviews_page, "view-only")
        self.assertNotContains(reviews_page, 'name="review_action"')

        school_change = client.get(reverse("admin:schools_school_change", args=[own.pk]))
        self.assertEqual(school_change.status_code, 200)
        self.assertContains(school_change, "Profile review")
        self.assertNotContains(school_change, 'id="id_slug"')

        model_admin = SchoolAdmin(School, admin.site)
        admin_request = SimpleNamespace(user=user)
        form = SimpleNamespace(
            changed_data=["about"],
            cleaned_data={"about": "Pending from the Django profile editor"},
            save_m2m=Mock(),
        )
        with patch("apps.schools.admin.messages.success"):
            model_admin.save_model(admin_request, own, form, change=True)
            model_admin.save_related(admin_request, form, [], change=True)
        own.refresh_from_db()
        self.assertEqual(own.about, "")
        self.assertIn("slug", model_admin.get_readonly_fields(admin_request, own))
        self.assertNotIn("slug", model_admin.get_prepopulated_fields(admin_request, own))
        form.save_m2m.assert_not_called()
        pending_profile = SchoolProfileChange.objects.get(
            school=own,
            status=SchoolProfileChange.STATUS_PENDING,
        )
        self.assertEqual(
            pending_profile.changes["about"],
            "Pending from the Django profile editor",
        )

        self.assertEqual(
            client.get(reverse("admin:schools_school_profile_review_queue")).status_code,
            403,
        )
        staff_reviewer = User.objects.create_user(
            username="profile-review-staff",
            email="profile-review-staff@example.test",
            password="secret-pass",
            role=User.ROLE_STAFF_ADMIN,
            is_staff=True,
        )
        queue_url = reverse("admin:schools_school_profile_review_queue")
        staff_client = APIClient()
        staff_client.force_login(staff_reviewer)
        self.assertEqual(staff_client.get(queue_url).status_code, 403)

        reviewer = User.objects.create_user(
            username="profile-review-superadmin",
            email="profile-review-superadmin@example.test",
            password="secret-pass",
            role=User.ROLE_SUPER_ADMIN,
            is_staff=True,
        )
        reviewer_client = APIClient()
        reviewer_client.force_login(reviewer)
        queue = reviewer_client.get(queue_url)
        self.assertEqual(queue.status_code, 200)
        self.assertContains(queue, "Pending from the Django profile editor")
        approved = reviewer_client.post(
            queue_url,
            {
                "change_id": str(pending_profile.pk),
                "action": "approve",
                "review_note": "Reviewed",
            },
        )
        self.assertEqual(approved.status_code, 302)
        own.refresh_from_db()
        self.assertEqual(own.about, "Pending from the Django profile editor")

        own_lead_page = client.get(
            reverse("admin:admissions_admissionenquiry_change", args=[own_lead.pk])
        )
        self.assertEqual(own_lead_page.status_code, 200)
        self.assertNotContains(own_lead_page, "Visible Parent")
        self.assertNotContains(own_lead_page, "919876543210")
        self.assertNotContains(own_lead_page, "visible-parent@example.test")
        self.assertNotContains(own_lead_page, "Private Child")
        locked_leads = client.get(reverse("admin:admissions_admissionenquiry_changelist"))
        self.assertNotContains(locked_leads, "Visible Parent")
        self.assertNotContains(locked_leads, "919876543210")
        self.assertNotContains(locked_leads, "visible-parent@example.test")

        plan = SubscriptionPlan.objects.create(
            name="Admin Contact Plan",
            price="100.00",
            duration_days=365,
            lead_access=True,
        )
        now = timezone.now()
        SchoolSubscription.objects.create(
            school=own,
            plan=plan,
            status=SchoolSubscription.STATUS_ACTIVE,
            starts_at=now - timedelta(days=1),
            expires_at=now + timedelta(days=30),
        )
        unlocked_lead_page = client.get(
            reverse("admin:admissions_admissionenquiry_change", args=[own_lead.pk])
        )
        self.assertContains(unlocked_lead_page, "Visible Parent")
        self.assertContains(unlocked_lead_page, "visible-parent@example.test")
        self.assertContains(unlocked_lead_page, "Private Child")
        unlocked_workspace = client.get(workspace_url)
        self.assertContains(unlocked_workspace, "Visible Parent")
        self.assertContains(unlocked_workspace, "919876543210")
        self.assertContains(unlocked_workspace, "visible-parent@example.test")
        unlocked_leads = client.get(reverse("admin:admissions_admissionenquiry_changelist"))
        self.assertContains(unlocked_leads, "Visible Parent")
        self.assertContains(unlocked_leads, "919876543210")

        own_payment = SubscriptionPayment.objects.create(
            school=own,
            plan=plan,
            amount="100.00",
            provider_order_id="own-admin-payment",
        )
        SubscriptionPayment.objects.create(
            school=other,
            plan=plan,
            amount="100.00",
            provider_order_id="other-admin-payment",
        )
        subscription_page = client.get(
            reverse(
                "admin:school_subscription_section",
                kwargs={"school_slug": own.slug, "section_slug": "plans"},
            )
        )
        self.assertEqual(subscription_page.status_code, 200)
        self.assertContains(subscription_page, "Admin Contact Plan")
        self.assertContains(subscription_page, own_payment.provider_order_id)
        self.assertNotContains(subscription_page, "other-admin-payment")

        library = Facility.objects.create(
            facility_code="LIB-OWN",
            category="ACADEMIC",
            facility_name="Own Admin Library",
            slug="own-admin-library",
        )
        turned_on = client.post(
            facilities_url,
            {"facility": str(library.facility_id), "campus": "ACADEMIC", "campus_action": "yes"},
        )
        self.assertEqual(turned_on.status_code, 302)
        self.assertFalse(
            SchoolFacility.objects.filter(
                school=own, facility=library, available=True
            ).exists()
        )
        turned_off = client.post(
            facilities_url,
            {"facility": str(library.facility_id), "campus": "ACADEMIC", "campus_action": "no"},
        )
        self.assertEqual(turned_off.status_code, 302)
        self.assertFalse(SchoolFacility.objects.filter(school=own, facility=library).exists())

        leads = client.get(reverse("admin:admissions_admissionenquiry_changelist"))
        self.assertEqual(leads.status_code, 200)
        self.assertContains(leads, own_lead.enquiry_code)
        self.assertContains(leads, "Visible Parent")
        self.assertContains(leads, "919876543210")
        self.assertNotContains(leads, "Hidden Parent")

        other_page = client.get(reverse("admin:schools_school_change", args=[other.pk]))
        self.assertEqual(other_page.status_code, 302)
        self.assertEqual(other_page.url, reverse("admin:index"))

        users_page = client.get(reverse("admin:users_user_changelist"))
        self.assertEqual(users_page.status_code, 403)


class PlatformAdminPanelTests(TestCase):
    def test_login_page_and_staff_home_list_schools(self):
        country = Country.objects.create(country_code="IN", country_name="India", slug="india-panel")
        state = State.objects.create(
            country=country, state_code="TS", state_name="Telangana", slug="telangana-panel"
        )
        city = City.objects.create(
            state=state, city_code="YDB", city_name="Yadadri", slug="yadadri-panel"
        )
        School.objects.create(
            school_code="PANEL-1",
            school_name="Sri Sri Academy",
            slug="sri-sri-academy-panel",
            country=country,
            state=state,
            city=city,
            address="Bhongir",
            email="office@srisri.test",
            phone="919876543210",
            verification_status="VERIFIED",
        )
        User.objects.create_superuser(
            username="panel-super",
            email="panel-super@boardingedu.test",
            password="secret-pass",
        )
        client = APIClient()

        login_page = client.get("/admin/login/")
        self.assertEqual(login_page.status_code, 200)
        self.assertContains(login_page, "School administration")
        self.assertContains(login_page, "id_username")

        self.assertTrue(client.login(username="panel-super", password="secret-pass"))
        home = client.get("/admin/")
        self.assertEqual(home.status_code, 200)
        self.assertContains(home, "Sri Sri Academy")
        self.assertContains(home, "Approved")
        self.assertContains(home, "Pending approval")

        schools = client.get(reverse("admin:schools_school_changelist"))
        self.assertContains(schools, "office@srisri.test")
        self.assertContains(schools, "Edit school")
        self.assertContains(schools, "View profile")


class ParentRegistrationWithoutEmailVerificationTests(TestCase):
    def test_registration_requires_otp_before_tokens(self):
        from unittest.mock import patch

        from django.test import override_settings

        client = APIClient()
        with override_settings(
            OTP_BACKEND="memory",
            CLOUDFLARE_EMAIL_API_TOKEN="test-token",
            CLOUDFLARE_EMAIL_ACCOUNT_ID="test-account",
            CLOUDFLARE_EMAIL_FROM="no-reply@boardingedu.com",
        ), patch("apps.notifications.otp.generate_code", return_value="654321"), patch(
            "apps.notifications.email_provider.requests.post"
        ) as send:
            send.return_value.status_code = 200
            send.return_value.ok = True
            send.return_value.json.return_value = {
                "success": True,
                "result": {"delivered": ["parent-otp@example.test"], "queued": [], "message_id": "cf-2"},
            }
            registration = client.post(
                "/api/users/users/register/",
                {
                    "username": "parent-otp",
                    "email": "parent-otp@example.test",
                    "first_name": "Parent",
                    "last_name": "OTP",
                    "phone": "+919876543210",
                    "password": "secret-pass",
                    "password_confirm": "secret-pass",
                },
                format="json",
            )
            self.assertEqual(registration.status_code, 201, registration.data)
            self.assertTrue(registration.data.get("otp_required"))
            self.assertNotIn("access", registration.data)
            from apps.notifications.otp import get_store
            from apps.users.models import User

            get_store().delete(f"otp:cooldown:register:{User.objects.get(username='parent-otp').pk}")
            blocked = client.post(
                "/api/auth/jwt/token/",
                {"username": "parent-otp", "password": "secret-pass"},
                format="json",
            )
        self.assertEqual(blocked.status_code, 200, blocked.data)
        self.assertEqual(blocked.data.get("purpose"), "register")
        self.assertNotIn("access", blocked.data)
