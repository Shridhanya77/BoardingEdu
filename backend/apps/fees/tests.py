from datetime import date

from django.contrib.admin.sites import AdminSite
from django.test import TestCase

from apps.geography.models import City, Country, State
from apps.schools.admin import SchoolAdmin
from apps.schools.models import School
from .models import AcademicYear, FeeItem, FeeStructure


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
