from datetime import date

from django.contrib.admin.sites import AdminSite
from django.forms import inlineformset_factory
from django.test import TestCase

from apps.fees.admin import FeeItemInlineFormSet, FeeStructureAdminForm
from apps.geography.models import City, Country, State
from apps.schools.admin import SchoolAdmin
from apps.schools.models import School
from .models import AcademicYear, FeeItem, FeeStructure


class FeeStructureAdminFormTests(TestCase):
    @classmethod
    def setUpTestData(cls):
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
        cls.school = School.objects.create(
            school_code="FEE-AUTO",
            school_name="Fee Auto School",
            slug="fee-auto-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
        )
        cls.other_school = School.objects.create(
            school_code="FEE-OTHER",
            school_name="Fee Other School",
            slug="fee-other-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
        )
        cls.academic_year = AcademicYear.objects.create(
            year_code="2026-27",
            year_name="Academic Year 2026-27",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True,
        )

    def form_data(self, school, structure_code=""):
        return {
            "structure_code": structure_code,
            "structure_name": "Annual fees",
            "school": str(school.pk),
            "academic_year": str(self.academic_year.pk),
            "effective_from": "2026-04-01",
            "effective_to": "",
            "payment_terms": "",
            "description": "",
            "status": "on",
            "published": "",
        }

    def test_duplicate_structure_code_is_a_form_error(self):
        FeeStructure.objects.create(
            structure_code="SHARED-2026",
            structure_name="Existing fees",
            school=self.other_school,
            academic_year=self.academic_year,
            effective_from=date(2026, 4, 1),
        )

        form = FeeStructureAdminForm(
            data=self.form_data(self.school, "SHARED-2026"),
        )

        self.assertFalse(form.is_valid())
        self.assertIn("already in use", str(form.errors["structure_code"]))

    def test_blank_structure_code_is_generated_and_made_unique(self):
        FeeStructure.objects.create(
            structure_code="FEE-AUTO-2026-27",
            structure_name="Existing fees",
            school=self.other_school,
            academic_year=self.academic_year,
            effective_from=date(2026, 4, 1),
        )

        form = FeeStructureAdminForm(data=self.form_data(self.school))

        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["structure_code"], "FEE-AUTO-2026-27-2")

    def test_duplicate_fee_item_scope_has_a_row_level_error(self):
        structure = FeeStructure.objects.create(
            structure_code="FEE-DUPLICATE-2026",
            structure_name="Doon School fees",
            school=self.school,
            academic_year=self.academic_year,
            effective_from=date(2026, 4, 1),
        )
        FeeItem.objects.create(
            fee_structure=structure,
            item_code="TUITION",
            item_name="Tuition fee",
            item_category="TUITION",
            amount="100000.00",
        )
        fee_item_formset = inlineformset_factory(
            FeeStructure,
            FeeItem,
            formset=FeeItemInlineFormSet,
            fields=(
                "item_code",
                "item_name",
                "item_category",
                "grade",
                "school_type",
                "amount",
                "payment_frequency",
                "tax_rate_pct",
                "is_refundable",
                "sort_order",
                "description",
            ),
            extra=1,
        )
        formset = fee_item_formset(
            data={
                "fee_items-TOTAL_FORMS": "1",
                "fee_items-INITIAL_FORMS": "0",
                "fee_items-MIN_NUM_FORMS": "0",
                "fee_items-MAX_NUM_FORMS": "1000",
                "fee_items-0-item_code": "TUITION",
                "fee_items-0-item_name": "Tuition fee for another grade",
                "fee_items-0-item_category": "TUITION",
                "fee_items-0-grade": "",
                "fee_items-0-school_type": "",
                "fee_items-0-amount": "120000.00",
                "fee_items-0-payment_frequency": "ANNUAL",
                "fee_items-0-tax_rate_pct": "0.00",
                "fee_items-0-is_refundable": "",
                "fee_items-0-sort_order": "0",
                "fee_items-0-description": "",
            },
            instance=structure,
            prefix="fee_items",
            queryset=FeeItem.objects.none(),
        )

        self.assertFalse(formset.is_valid())
        self.assertIn("already used", str(formset.forms[0].errors["item_code"]))


class FeeItemPaymentFrequencyTests(TestCase):
    def test_fee_item_api_returns_payment_frequency(self):
        country = Country.objects.create(
            country_code='IN',
            country_name='India',
            slug='india',
        )
        state = State.objects.create(
            country=country,
            state_code='KA',
            state_name='Karnataka',
            slug='karnataka',
        )
        city = City.objects.create(
            state=state,
            city_code='BLR',
            city_name='Bengaluru',
            slug='bengaluru',
        )
        school = School.objects.create(
            school_code='FEE-TEST',
            school_name='Fee Test School',
            slug='fee-test-school',
            country=country,
            state=state,
            city=city,
            address='Bengaluru',
        )
        academic_year = AcademicYear.objects.create(
            year_code='2026-27',
            year_name='Academic Year 2026-27',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True,
        )
        structure = FeeStructure.objects.create(
            structure_code='FEE-TEST-2026',
            structure_name='Published fees',
            school=school,
            academic_year=academic_year,
            effective_from=date(2026, 4, 1),
            published=True,
        )
        item = FeeItem.objects.create(
            fee_structure=structure,
            item_code='ADMISSION',
            item_name='Admission Fee',
            item_category='ADMISSION',
            amount='83000.00',
            payment_frequency='ONE_TIME',
        )
        dynamic_item = FeeItem.objects.create(
            fee_structure=structure,
            item_code='TRANSPORT',
            item_name='Transport Fee',
            item_category='TRANSPORT',
            amount=None,
            payment_frequency='BY_DISTANCE',
            description='Charged according to the student’s pickup distance.',
        )
        panel = str(SchoolAdmin(School, AdminSite()).fee_structures_panel(school))
        self.assertIn('Published fees', panel)
        self.assertIn('Published', panel)
        self.assertIn('2 fee items', panel)

        response = self.client.get('/api/fees/fee-items/')

        self.assertEqual(response.status_code, 200)
        result = next(row for row in response.data['results'] if row['id'] == str(item.pk))
        self.assertEqual(result['payment_frequency'], 'ONE_TIME')
        self.assertEqual(result['payment_frequency_display'], 'One-time')
        dynamic_result = next(
            row for row in response.data['results'] if row['id'] == str(dynamic_item.pk)
        )
        self.assertIsNone(dynamic_result['amount'])
        self.assertEqual(dynamic_result['payment_frequency'], 'BY_DISTANCE')
        self.assertEqual(
            dynamic_result['description'],
            'Charged according to the student’s pickup distance.',
        )

# Create your tests here.
