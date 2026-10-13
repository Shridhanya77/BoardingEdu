from datetime import date
from decimal import Decimal

from django.http import QueryDict
from django.test import TestCase

from apps.fees.models import AcademicYear, FeeItem, FeeStructure
from apps.geography.models import City, Country, State
from .models import Board, School, SchoolType
from .serializers import SchoolDetailSerializer, SchoolListSerializer
from .views import SchoolFilter, SchoolViewSet


class SchoolClassificationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = Country.objects.create(
            country_code='IN',
            country_name='India',
            slug='india',
        )
        cls.state = State.objects.create(
            country=cls.country,
            state_code='KA',
            state_name='Karnataka',
            slug='karnataka',
        )
        cls.city = City.objects.create(
            state=cls.state,
            city_code='BLR',
            city_name='Bengaluru',
            slug='bengaluru',
        )
        cls.cbse = Board.objects.create(
            board_code='CBSE',
            board_name='CBSE',
            slug='cbse',
        )
        cls.ib = Board.objects.create(
            board_code='IB',
            board_name='International Baccalaureate',
            slug='ib',
        )
        cls.day = SchoolType.objects.create(
            type_code='DAY',
            type_name='Day School',
            slug='day-school',
        )
        cls.boarding = SchoolType.objects.create(
            type_code='BOARDING',
            type_name='Boarding School',
            slug='boarding-school',
        )

    def create_school(self, code):
        return School.objects.create(
            school_code=code,
            school_name=f'{code} School',
            slug=f'{code.lower()}-school',
            country=self.country,
            state=self.state,
            city=self.city,
            address='Bengaluru',
        )

    def test_school_accepts_multiple_boards_and_types(self):
        payload = {
            'school_code': 'MULTI',
            'school_name': 'Multi Classification School',
            'country': str(self.country.pk),
            'state': str(self.state.pk),
            'city': str(self.city.pk),
            'address': 'Bengaluru',
            'boards': [str(self.cbse.pk), str(self.ib.pk)],
            'school_types': [str(self.day.pk), str(self.boarding.pk)],
        }

        serializer = SchoolDetailSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        school = serializer.save()

        self.assertSetEqual(set(school.boards.all()), {self.cbse, self.ib})
        self.assertSetEqual(set(school.school_types.all()), {self.day, self.boarding})

        detail = SchoolDetailSerializer(school).data
        self.assertEqual(len(detail['boards_detail']), 2)
        self.assertEqual(len(detail['school_types_detail']), 2)

        listing = SchoolListSerializer(school).data
        self.assertEqual(len(listing['boards_detail']), 2)
        self.assertEqual(len(listing['school_types_detail']), 2)

    def test_school_accepts_legacy_single_classification_input(self):
        school = self.create_school('LEGACY')
        serializer = SchoolDetailSerializer(
            school,
            data={
                'board': str(self.cbse.pk),
                'school_type': str(self.day.pk),
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_school = serializer.save()
        self.assertEqual(list(updated_school.boards.all()), [self.cbse])
        self.assertEqual(list(updated_school.school_types.all()), [self.day])

    def test_repeated_board_and_type_filters_match_any_within_each_group(self):
        both = self.create_school('BOTH')
        both.boards.add(self.cbse, self.ib)
        both.school_types.add(self.day, self.boarding)

        cbse_day = self.create_school('CBDAY')
        cbse_day.boards.add(self.cbse)
        cbse_day.school_types.add(self.day)

        ib_boarding = self.create_school('IBBOARD')
        ib_boarding.boards.add(self.ib)
        ib_boarding.school_types.add(self.boarding)

        params = QueryDict('', mutable=True)
        params.setlist('board', [str(self.cbse.pk), str(self.ib.pk)])
        params.setlist('school_type', [str(self.day.pk), str(self.boarding.pk)])
        result = SchoolFilter(params, queryset=School.objects.all())

        self.assertTrue(result.is_valid(), result.errors)
        self.assertSetEqual(
            set(result.qs.values_list('school_code', flat=True)),
            {'BOTH', 'CBDAY', 'IBBOARD'},
        )

        params.setlist('school_type', [str(self.boarding.pk)])
        boarding_result = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(boarding_result.is_valid(), boarding_result.errors)
        self.assertSetEqual(
            set(boarding_result.qs.values_list('school_code', flat=True)),
            {'BOTH', 'IBBOARD'},
        )

    def test_location_groups_match_selected_countries_and_states(self):
        maharashtra = State.objects.create(
            country=self.country,
            state_code='MH',
            state_name='Maharashtra',
            slug='maharashtra',
        )
        mumbai = City.objects.create(
            state=maharashtra,
            city_code='MUM',
            city_name='Mumbai',
            slug='mumbai',
        )
        maharashtra_school = School.objects.create(
            school_code='MH-SCHOOL',
            school_name='Maharashtra School',
            slug='maharashtra-school',
            country=self.country,
            state=maharashtra,
            city=mumbai,
            address='Mumbai',
        )
        maharashtra_school.school_types.add(self.boarding)
        karnataka_school = self.create_school('KA-SCHOOL')
        karnataka_school.school_types.add(self.day)

        other_country = Country.objects.create(
            country_code='US',
            country_name='United States',
            slug='united-states',
        )
        california = State.objects.create(
            country=other_country,
            state_code='CA',
            state_name='California',
            slug='california',
        )
        los_angeles = City.objects.create(
            state=california,
            city_code='LA',
            city_name='Los Angeles',
            slug='los-angeles',
        )
        other_country_school = School.objects.create(
            school_code='US-SCHOOL',
            school_name='United States School',
            slug='united-states-school',
            country=other_country,
            state=california,
            city=los_angeles,
            address='Los Angeles',
        )
        other_country_school.school_types.add(self.day)

        params = QueryDict('', mutable=True)
        params.setlist(
            'location_group',
            [
                f'{self.country.pk}|{self.state.pk},{maharashtra.pk}',
                str(other_country.pk),
            ],
        )
        result = SchoolFilter(params, queryset=School.objects.all())

        self.assertTrue(result.is_valid(), result.errors)
        self.assertSetEqual(
            set(result.qs.values_list('school_code', flat=True)),
            {'KA-SCHOOL', 'MH-SCHOOL', 'US-SCHOOL'},
        )

        params.setlist('location_group', [str(self.country.pk)])
        country_only = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(country_only.is_valid(), country_only.errors)
        self.assertSetEqual(
            set(country_only.qs.values_list('school_code', flat=True)),
            {'KA-SCHOOL', 'MH-SCHOOL'},
        )

        params.setlist('location_group', [f'{self.country.pk}|{maharashtra.pk}'])
        params.setlist('school_type', [str(self.boarding.pk)])
        boarding_in_selected_state = SchoolFilter(
            params,
            queryset=School.objects.all(),
        )
        self.assertTrue(
            boarding_in_selected_state.is_valid(),
            boarding_in_selected_state.errors,
        )
        self.assertSetEqual(
            set(boarding_in_selected_state.qs.values_list('school_code', flat=True)),
            {'MH-SCHOOL'},
        )

        params.setlist('location_group', [f'{self.country.pk}|{california.pk}'])
        invalid_group = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(invalid_group.is_valid(), invalid_group.errors)
        self.assertFalse(invalid_group.qs.exists())

    def test_fee_range_filters_only_published_current_year_totals(self):
        current_year = AcademicYear.objects.create(
            year_code='2026-27',
            year_name='Academic Year 2026-27',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True,
        )
        affordable = self.create_school('AFFORDABLE')
        published_structure = FeeStructure.objects.create(
            structure_code='AFFORDABLE-2026',
            structure_name='Published fees',
            school=affordable,
            academic_year=current_year,
            effective_from=date(2026, 4, 1),
            status=True,
            published=True,
        )
        FeeItem.objects.create(
            fee_structure=published_structure,
            item_code='TUITION',
            item_name='Tuition',
            amount=Decimal('750000'),
        )

        expensive = self.create_school('EXPENSIVE')
        expensive_structure = FeeStructure.objects.create(
            structure_code='EXPENSIVE-2026',
            structure_name='Published fees',
            school=expensive,
            academic_year=current_year,
            effective_from=date(2026, 4, 1),
            status=True,
            published=True,
        )
        FeeItem.objects.create(
            fee_structure=expensive_structure,
            item_code='TUITION',
            item_name='Tuition',
            amount=Decimal('2500000'),
        )

        params = QueryDict('min_fee=500000&max_fee=1000000')
        result = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(result.is_valid(), result.errors)
        self.assertSetEqual(
            set(result.qs.values_list('school_code', flat=True)),
            {'AFFORDABLE'},
        )

    def test_school_list_api_returns_current_published_annual_fee(self):
        current_year = AcademicYear.objects.create(
            year_code='2026-27',
            year_name='Academic Year 2026-27',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True,
        )
        school = self.create_school('FEEAPI')
        structure = FeeStructure.objects.create(
            structure_code='FEEAPI-2026',
            structure_name='Published fees',
            school=school,
            academic_year=current_year,
            effective_from=date(2026, 4, 1),
            status=True,
            published=True,
        )
        FeeItem.objects.create(
            fee_structure=structure,
            item_code='TUITION',
            item_name='Tuition',
            amount=Decimal('850000'),
        )

        school = SchoolViewSet().get_queryset().get(pk=school.pk)

        self.assertEqual(
            SchoolListSerializer(school).data['annual_fee'],
            Decimal('850000.00'),
        )
