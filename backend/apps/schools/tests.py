from datetime import date
from decimal import Decimal

from django.http import QueryDict
from django.test import TestCase

from apps.fees.models import AcademicYear, FeeItem, FeeStructure
from apps.geography.models import City, Country, Location, State
from .models import Board, Grade, School, SchoolGrade, SchoolPhoto, SchoolType
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
        cls.day_boarding = SchoolType.objects.create(
            type_code='DAY-BOARDING',
            type_name='Day Boarding',
            slug='day-boarding',
        )
        cls.boarding = SchoolType.objects.create(
            type_code='BOARDING',
            type_name='Boarding School',
            slug='boarding-school',
        )
        cls.full_boarding = SchoolType.objects.create(
            type_code='FULL-BOARDING',
            type_name='Full Boarding',
            slug='full-boarding',
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
        self.assertIsNone(listing['location_slug'])

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

    def test_school_logo_url_is_returned_in_list_and_detail_payloads(self):
        school = self.create_school('WITH-LOGO')
        school.school_logo_url = 'https://example.com/school-logo.png'
        school.school_image_url = 'https://example.com/school-building.jpg'
        school.save(update_fields=['school_logo_url', 'school_image_url'])

        self.assertEqual(SchoolListSerializer(school).data['school_logo_url'], school.school_logo_url)
        self.assertEqual(SchoolListSerializer(school).data['school_image_url'], school.school_image_url)
        self.assertEqual(SchoolDetailSerializer(school).data['school_logo_url'], school.school_logo_url)
        self.assertEqual(SchoolDetailSerializer(school).data['school_image_url'], school.school_image_url)

    def test_school_detail_includes_only_active_photos_in_display_order(self):
        school = self.create_school('WITH-PHOTOS')
        second = SchoolPhoto.objects.create(
            school=school,
            photo_url='https://example.com/second.jpg',
            caption='Library',
            sort_order=2,
        )
        first = SchoolPhoto.objects.create(
            school=school,
            photo_url='https://example.com/first.jpg',
            caption='Campus',
            sort_order=1,
        )
        SchoolPhoto.objects.create(
            school=school,
            photo_url='https://example.com/hidden.jpg',
            status=False,
        )

        photos = SchoolDetailSerializer(school).data['photos_detail']
        self.assertEqual(
            [photo['photo_id'] for photo in photos],
            [str(first.photo_id), str(second.photo_id)],
        )
        self.assertEqual(photos[0]['caption'], 'Campus')

    def test_grade_filter_matches_active_school_grade_offerings(self):
        grade = Grade.objects.create(
            grade_code='G6',
            grade_name='Grade 6',
            sort_order=6,
        )
        offered = self.create_school('GRADE-A')
        not_offered = self.create_school('GRADE-B')
        SchoolGrade.objects.create(school=offered, grade=grade, is_active=True)
        SchoolGrade.objects.create(school=not_offered, grade=grade, is_active=False)

        params = QueryDict("", mutable=True)
        params.setlist("grade", [str(grade.pk)])
        school_filter = SchoolFilter(params, queryset=School.objects.all())

        self.assertTrue(school_filter.is_valid(), school_filter.errors)
        self.assertSetEqual(set(school_filter.qs), {offered})

    def test_school_list_without_grade_filter_returns_school_records(self):
        self.create_school('LIST-A')
        self.create_school('LIST-B')

        response = self.client.get('/api/schools/schools/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 2)

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

    def test_location_filters_follow_the_country_state_city_locality_hierarchy(self):
        whitefield = Location.objects.create(
            city=self.city,
            location_code='WHF',
            location_name='Whitefield',
            slug='whitefield',
        )
        day_school = self.create_school('DAY-WHITEFIELD')
        day_school.location = whitefield
        day_school.save()
        day_school.school_types.add(self.day)

        boarding_school = self.create_school('BOARDING-WHITEFIELD')
        boarding_school.location = whitefield
        boarding_school.save()
        boarding_school.school_types.add(self.boarding)

        mumbai_state = State.objects.create(
            country=self.country,
            state_code='MH',
            state_name='Maharashtra',
            slug='maharashtra',
        )
        mumbai = City.objects.create(
            state=mumbai_state,
            city_code='MUM',
            city_name='Mumbai',
            slug='mumbai',
        )
        other_city_school = School.objects.create(
            school_code='DAY-MUMBAI',
            school_name='Mumbai School',
            slug='mumbai-school',
            country=self.country,
            state=mumbai_state,
            city=mumbai,
            address='Mumbai',
        )
        other_city_school.school_types.add(self.day)

        base = {
            'country': str(self.country.pk),
            'school_type': str(self.day.pk),
        }
        params = QueryDict('', mutable=True)
        for key, value in base.items():
            params[key] = value
        country_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(country_scope.is_valid(), country_scope.errors)
        self.assertSetEqual(set(country_scope.qs.values_list('school_code', flat=True)), {'DAY-WHITEFIELD', 'DAY-MUMBAI'})

        params['state'] = str(self.state.pk)
        state_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(state_scope.is_valid(), state_scope.errors)
        self.assertSetEqual(set(state_scope.qs.values_list('school_code', flat=True)), {'DAY-WHITEFIELD'})

        params['state'] = str(mumbai_state.pk)
        other_state_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(other_state_scope.is_valid(), other_state_scope.errors)
        self.assertSetEqual(
            set(other_state_scope.qs.values_list('school_code', flat=True)),
            {'DAY-MUMBAI'},
        )
        params['state'] = str(self.state.pk)

        params['city'] = str(self.city.pk)
        city_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(city_scope.is_valid(), city_scope.errors)
        self.assertSetEqual(set(city_scope.qs.values_list('school_code', flat=True)), {'DAY-WHITEFIELD'})

        params['city'] = str(mumbai.pk)
        invalid_city_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(invalid_city_scope.is_valid(), invalid_city_scope.errors)
        self.assertFalse(invalid_city_scope.qs.exists())
        params['city'] = str(self.city.pk)

        params['location'] = str(whitefield.pk)
        locality_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(locality_scope.is_valid(), locality_scope.errors)
        self.assertSetEqual(set(locality_scope.qs.values_list('school_code', flat=True)), {'DAY-WHITEFIELD'})

        params.setlist('school_type', [str(self.boarding.pk)])
        params.pop('city')
        params.pop('location')
        residential_city_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(residential_city_scope.is_valid(), residential_city_scope.errors)
        self.assertSetEqual(
            set(residential_city_scope.qs.values_list('school_code', flat=True)),
            {'BOARDING-WHITEFIELD'},
        )

    def test_home_residential_category_ignores_stale_locations_and_combines_boarding_types(self):
        whitefield = Location.objects.create(
            city=self.city,
            location_code='WHF',
            location_name='Whitefield',
            slug='whitefield',
        )
        residential = self.create_school('STALE-LOCATION-BOARDING')
        residential.location = whitefield
        residential.save()
        residential.school_types.add(self.day_boarding)
        full_boarding = self.create_school('STALE-LOCATION-FULL-BOARDING')
        full_boarding.location = whitefield
        full_boarding.save()
        full_boarding.school_types.add(self.full_boarding)
        day_school = self.create_school('NOT-RESIDENTIAL-DAY')
        day_school.location = whitefield
        day_school.save()
        day_school.school_types.add(self.day)
        legacy_school = self.create_school('LEGACY-CITY-BOARDING')
        legacy_school.location = whitefield
        legacy_school.save()
        legacy_school.school_types.add(self.boarding)

        other_state = State.objects.create(
            country=self.country,
            state_code='MH',
            state_name='Maharashtra',
            slug='maharashtra',
        )
        stale_city = City.objects.create(
            state=other_state,
            city_code='MUM',
            city_name='Mumbai',
            slug='mumbai',
        )
        other_state_residential = School.objects.create(
            school_code='OTHER-STATE-BOARDING',
            school_name='Other State Boarding School',
            slug='other-state-boarding-school',
            country=self.country,
            state=other_state,
            city=stale_city,
            address='Mumbai',
        )
        other_state_residential.school_types.add(self.day_boarding)

        params = QueryDict('', mutable=True)
        params.update({
            'country': str(self.country.pk),
            'state': str(self.state.pk),
            'city': str(stale_city.pk),
            'location': str(whitefield.pk),
            'home_category': 'residential-school',
        })
        result = SchoolFilter(params, queryset=School.objects.all())

        self.assertTrue(result.is_valid(), result.errors)
        self.assertSetEqual(
            set(result.qs.values_list('school_code', flat=True)),
            {'STALE-LOCATION-BOARDING', 'STALE-LOCATION-FULL-BOARDING', 'LEGACY-CITY-BOARDING'},
        )

        params.pop('state')
        country_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(country_scope.is_valid(), country_scope.errors)
        self.assertSetEqual(
            set(country_scope.qs.values_list('school_code', flat=True)),
            {
                'STALE-LOCATION-BOARDING',
                'STALE-LOCATION-FULL-BOARDING',
                'OTHER-STATE-BOARDING',
                'LEGACY-CITY-BOARDING',
            },
        )

        params['state'] = str(self.state.pk)
        params['home_category'] = 'day-school'
        params['city'] = str(self.city.pk)
        params['location'] = str(whitefield.pk)
        day_school_result = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(day_school_result.is_valid(), day_school_result.errors)
        self.assertSetEqual(
            set(day_school_result.qs.values_list('school_code', flat=True)),
            {'NOT-RESIDENTIAL-DAY'},
        )

        params.pop('home_category')
        params['city'] = str(stale_city.pk)
        params['school_type'] = str(self.full_boarding.pk)
        legacy_residential_result = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(legacy_residential_result.is_valid(), legacy_residential_result.errors)
        self.assertSetEqual(
            set(legacy_residential_result.qs.values_list('school_code', flat=True)),
            {'STALE-LOCATION-FULL-BOARDING'},
        )

        # Existing school-type queries continue to respect location filters.
        params['city'] = str(self.city.pk)
        params['school_type'] = str(self.boarding.pk)
        legacy_filter_result = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(legacy_filter_result.is_valid(), legacy_filter_result.errors)
        self.assertSetEqual(
            set(legacy_filter_result.qs.values_list('school_code', flat=True)),
            {'LEGACY-CITY-BOARDING'},
        )

    def test_school_type_filters_distinguish_day_boarding_and_full_boarding(self):
        day_school = self.create_school('TYPE-DAY')
        day_school.school_types.add(self.day)
        boarding_school = self.create_school('TYPE-BOARDING')
        boarding_school.school_types.add(self.boarding)
        full_boarding_school = self.create_school('TYPE-FULL-BOARDING')
        full_boarding_school.school_types.add(self.full_boarding)

        for school_type, expected in (
            (self.day, 'TYPE-DAY'),
            (self.boarding, 'TYPE-BOARDING'),
            (self.full_boarding, 'TYPE-FULL-BOARDING'),
        ):
            params = QueryDict('', mutable=True)
            params['school_type'] = str(school_type.pk)
            result = SchoolFilter(params, queryset=School.objects.all())
            self.assertTrue(result.is_valid(), result.errors)
            self.assertSetEqual(
                set(result.qs.values_list('school_code', flat=True)),
                {expected},
            )

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
