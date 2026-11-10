import hashlib
import hmac
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.admissions.models import AdmissionEnquiry
from apps.fees.models import AcademicYear
from apps.geography.models import City, Country, State
from apps.schools.models import School
from apps.subscriptions.models import SchoolSubscription, SubscriptionPayment, SubscriptionPlan
from apps.subscriptions.payments import activate_from_provider_payment, signature_is_valid
from apps.users.models import SchoolAdminProfile, User


@override_settings(RAZORPAY_KEY_ID="rzp_test", RAZORPAY_KEY_SECRET="secret-key", RAZORPAY_WEBHOOK_SECRET="whsec")
class LeadSubscriptionAccessTests(TestCase):
    def setUp(self):
        country = Country.objects.create(country_code="IN", country_name="India", slug="india-sub")
        state = State.objects.create(country=country, state_code="KA", state_name="Karnataka", slug="karnataka-sub")
        city = City.objects.create(state=state, city_code="BLR", city_name="Bengaluru", slug="bengaluru-sub")
        self.own = School.objects.create(
            school_code="SUB-OWN",
            school_name="Own Subscription School",
            slug="own-subscription-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            verification_status="VERIFIED",
        )
        self.other = School.objects.create(
            school_code="SUB-OTHER",
            school_name="Other Subscription School",
            slug="other-subscription-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            verification_status="VERIFIED",
        )
        year = AcademicYear.objects.create(
            year_code="2026-27-sub",
            year_name="2026-27",
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=360),
        )
        self.lead = AdmissionEnquiry.objects.create(
            school=self.own,
            academic_year=year,
            guest_full_name="Parent Private",
            guest_email="parent@private.test",
            guest_phone="919111111111",
            guest_child_name="Student Private",
            message="Please call me.",
        )
        self.other_lead = AdmissionEnquiry.objects.create(
            school=self.other,
            academic_year=year,
            guest_full_name="Other Parent",
            guest_email="other@private.test",
            guest_phone="919222222222",
        )
        self.user = User.objects.create_user(
            username="sub-school-admin",
            email="sub-admin@boardingedu.test",
            password="secret-pass",
            role=User.ROLE_SCHOOL_ADMIN,
        )
        SchoolAdminProfile.objects.create(user=self.user, school=self.own, designation="Principal")
        self.plan = SubscriptionPlan.objects.create(
            name="Lead access",
            description="Contact details for admission leads",
            price="4999.00",
            duration_days=30,
            lead_access=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_school_without_subscription_cannot_read_contacts(self):
        dashboard = self.client.get("/api/dashboards/school/")
        self.assertEqual(dashboard.status_code, 200, dashboard.data)
        row = dashboard.data["recent_enquiries"][0]
        self.assertEqual(row["enquiry_code"], self.lead.enquiry_code)
        self.assertEqual(row["parent_name"], "")
        self.assertEqual(row["parent_email"], "")
        self.assertEqual(row["parent_phone"], "")
        self.assertEqual(row["child_name"], "")
        self.assertEqual(row["message"], "")
        self.assertTrue(row["contacts_locked"])

        detail = self.client.get(f"/api/admissions/enquiries/{self.lead.enquiry_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["guest_email"], "")
        self.assertEqual(detail.data["guest_full_name"], "")
        self.assertTrue(detail.data["contacts_locked"])

        other = self.client.get(f"/api/admissions/enquiries/{self.other_lead.enquiry_id}/")
        self.assertEqual(other.status_code, 404)

    def test_verified_payment_unlocks_contacts_and_expiry_locks_them_again(self):
        payment = SubscriptionPayment.objects.create(
            school=self.own,
            plan=self.plan,
            amount=self.plan.price,
            currency="INR",
            provider_order_id="order_test_1",
        )
        signature = hmac.new(
            b"secret-key",
            b"order_test_1|pay_test_1",
            hashlib.sha256,
        ).hexdigest()
        self.assertTrue(signature_is_valid("order_test_1", "pay_test_1", signature))
        response = self.client.post(
            "/api/subscriptions/verify/",
            {
                "razorpay_order_id": "order_test_1",
                "razorpay_payment_id": "pay_test_1",
                "razorpay_signature": signature,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        again = self.client.post(
            "/api/subscriptions/verify/",
            {
                "razorpay_order_id": "order_test_1",
                "razorpay_payment_id": "pay_test_1",
                "razorpay_signature": signature,
            },
            format="json",
        )
        self.assertEqual(again.status_code, 200)
        self.assertEqual(SchoolSubscription.objects.filter(school=self.own, status="ACTIVE").count(), 1)

        detail = self.client.get(f"/api/admissions/enquiries/{self.lead.enquiry_id}/")
        self.assertEqual(detail.data["guest_email"], "parent@private.test")
        self.assertEqual(detail.data["guest_full_name"], "Parent Private")
        self.assertEqual(detail.data["guest_child_name"], "Student Private")
        self.assertFalse(detail.data["contacts_locked"])

        subscription = SchoolSubscription.objects.get(school=self.own, status="ACTIVE")
        subscription.expires_at = timezone.now() - timedelta(minutes=1)
        subscription.save(update_fields=["expires_at"])
        locked = self.client.get(f"/api/admissions/enquiries/{self.lead.enquiry_id}/")
        self.assertEqual(locked.data["guest_email"], "")
        self.assertTrue(locked.data["contacts_locked"])
        subscription.refresh_from_db()
        self.assertEqual(subscription.status, "EXPIRED")

    def test_bad_signature_does_not_activate(self):
        SubscriptionPayment.objects.create(
            school=self.own,
            plan=self.plan,
            amount=self.plan.price,
            currency="INR",
            provider_order_id="order_test_bad",
        )
        response = self.client.post(
            "/api/subscriptions/verify/",
            {
                "razorpay_order_id": "order_test_bad",
                "razorpay_payment_id": "pay_bad",
                "razorpay_signature": "not-a-real-signature",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(SchoolSubscription.objects.filter(school=self.own).exists())
        payment = SubscriptionPayment.objects.get(provider_order_id="order_test_bad")
        self.assertEqual(payment.status, "FAILED")

    def test_activate_helper_is_idempotent(self):
        payment = SubscriptionPayment.objects.create(
            school=self.own,
            plan=self.plan,
            amount=self.plan.price,
            currency="INR",
            provider_order_id="order_test_once",
        )
        first = activate_from_provider_payment(payment, "pay_once")
        second = activate_from_provider_payment(payment, "pay_once")
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(SchoolSubscription.objects.filter(school=self.own).count(), 1)
