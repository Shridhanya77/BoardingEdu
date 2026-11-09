from datetime import date

from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.admissions.models import AdmissionEnquiry
from apps.fees.models import AcademicYear
from apps.geography.models import City, Country, State
from apps.schools.models import School
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
            is_email_verified=True,
        )
        admin = User.objects.get(username="pending-school-admin")
        SchoolAdminProfile.objects.create(user=admin, school=school, designation="Principal")

        response = APIClient().post(
            "/api/auth/jwt/token/",
            {"username": "pending-school-admin", "password": "secret-pass"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("access", response.data)


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
            is_email_verified=True,
            password="secret-pass",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        SchoolAdminProfile.objects.create(user=user, school=own, designation="Principal")
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
        )
        AdmissionEnquiry.objects.create(
            school=other,
            academic_year=year,
            guest_full_name="Hidden Parent",
            guest_phone="919000000000",
        )

        home = client.get("/admin/")
        self.assertEqual(home.status_code, 302)
        self.assertEqual(home.url, reverse("admin:school_workspace"))
        workspace = client.get(home.url)
        self.assertEqual(workspace.status_code, 200)
        self.assertContains(workspace, "Own Admin School")
        self.assertContains(workspace, "Visible Parent")
        self.assertNotContains(workspace, "Other Admin School")
        self.assertNotContains(workspace, "Hidden Parent")
        self.assertContains(workspace, "Your school")
        self.assertNotContains(workspace, "Countries")

        leads = client.get(reverse("admin:admissions_admissionenquiry_changelist"))
        self.assertEqual(leads.status_code, 200)
        self.assertContains(leads, own_lead.enquiry_code)
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
