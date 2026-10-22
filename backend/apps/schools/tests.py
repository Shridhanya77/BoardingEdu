from datetime import date
from decimal import Decimal
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.apps import apps
from django.db import connection
from django.http import QueryDict
from django.urls import reverse
from django.test import SimpleTestCase, TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.admissions.models import CounsellingRequest
from apps.fees.models import AcademicYear, FeeItem, FeeStructure
from apps.geography.models import City, Country, Location, State
from apps.users.models import User
from .cloudinary_uploads import CloudinaryUploadError, upload_school_image
from .models import Board, Grade, School, SchoolFAQ, SchoolGrade, SchoolPhoto, SchoolType, SchoolVerificationEvent, SchoolVideo
from .serializers import SchoolDetailSerializer, SchoolListSerializer
from .seo import school_seo_keywords
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
        cls.day = SchoolType.objects.get(
            type_code='DAY',
        )
        cls.day_boarding = SchoolType.objects.get(
            type_code='DAY-BOARDING',
        )
        cls.boarding = SchoolType.objects.get(
            type_code='BOARDING',
        )
        cls.full_boarding = SchoolType.objects.create(
            type_code='FULL-BOARDING',
            type_name='Full Boarding',
            slug='full-boarding',
        )

    def test_school_keywords_cover_distinct_parent_searches(self):
        school = self.create_school('SEOKEY')
        school.school_name = 'Green Valley Academy'
        school.save(update_fields=['school_name'])
        school.boards.add(self.cbse)
        school.school_types.add(self.boarding)

        keywords = school_seo_keywords(school)

        self.assertLessEqual(len(keywords), 12)
        self.assertEqual(len(keywords), len({item.lower() for item in keywords}))
        self.assertIn('Green Valley Academy admissions', keywords)
        self.assertIn('Green Valley Academy fees', keywords)
        self.assertIn('CBSE schools in Bengaluru', keywords)
        self.assertIn('Boarding School in Bengaluru', keywords)
        self.assertFalse(any(keywords.count(item) > 1 for item in keywords))

    def test_canonical_school_types_include_day_boarding_as_its_own_type(self):
        self.assertEqual(self.day.type_name, 'Day School')
        self.assertEqual(self.day_boarding.type_name, 'Day Boarding School')
        self.assertEqual(self.boarding.type_name, 'Boarding School')

    def test_featured_school_is_returned_and_filterable(self):
        featured = self.create_school('FEATURED')
        featured.is_featured = True
        featured.save(update_fields=['is_featured'])
        regular = self.create_school('REGULAR')

        featured_filter = SchoolFilter(
            QueryDict('is_featured=true'),
            queryset=School.objects.all(),
        )
        self.assertTrue(featured_filter.is_valid(), featured_filter.errors)
        self.assertSetEqual(
            set(featured_filter.qs.values_list('school_code', flat=True)),
            {'FEATURED'},
        )
        response = self.client.get(
            '/api/schools/schools/',
            {'is_featured': 'true', 'status': 'true'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item['school_code'] for item in response.data['results']],
            ['FEATURED'],
        )
        self.assertTrue(SchoolListSerializer(featured).data['is_featured'])
        self.assertFalse(SchoolListSerializer(regular).data['is_featured'])
        self.assertTrue(SchoolDetailSerializer(featured).data['is_featured'])
        serializer = SchoolDetailSerializer(
            featured,
            data={'is_featured': False},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        featured.refresh_from_db()
        self.assertTrue(featured.is_featured)

    def test_type_migration_merges_legacy_full_boarding_school_assignments(self):
        school = self.create_school('MIGRATE-FULL-BOARDING')
        school.school_types.add(self.full_boarding)
        counselling_request = CounsellingRequest.objects.create(
            parent_name='Parent',
            email='parent@example.com',
            phone='1234567890',
        )
        counselling_request.school_types.add(self.full_boarding)
        academic_year = AcademicYear.objects.create(
            year_code='MIGRATION-2026',
            year_name='Migration test year',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        fee_structure = FeeStructure.objects.create(
            structure_code='MIGRATION-STRUCTURE',
            structure_name='Migration test fees',
            school=school,
            academic_year=academic_year,
            effective_from=date(2026, 1, 1),
        )
        fee_item = FeeItem.objects.create(
            fee_structure=fee_structure,
            item_code='HOSTEL',
            item_name='Hostel fee',
            school_type=self.full_boarding,
        )

        migration = import_module(
            'apps.schools.migrations.0009_canonical_school_types_and_featured'
        )
        migration.canonicalize_school_types(
            apps,
            SimpleNamespace(connection=connection),
        )

        self.assertEqual(SchoolType.objects.count(), 3)
        self.assertSetEqual(set(school.school_types.all()), {self.boarding})
        self.assertSetEqual(set(counselling_request.school_types.all()), {self.boarding})
        fee_item.refresh_from_db()
        self.assertEqual(fee_item.school_type, self.boarding)
        self.assertFalse(SchoolType.objects.filter(type_name='Full Boarding').exists())

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

    def test_school_detail_and_listing_include_school_media(self):
        school = self.create_school('WITH-MEDIA')
        photo = SchoolPhoto.objects.create(
            school=school,
            photo_url='https://example.com/campus.jpg',
            caption='Campus',
        )
        SchoolVideo.objects.create(
            school=school,
            video_url='https://youtu.be/example',
            caption='Campus tour',
        )
        SchoolVideo.objects.create(
            school=school,
            video_url='https://youtu.be/hidden',
            status=False,
        )

        detail_response = self.client.get(
            f'/api/schools/schools/by-slug/{school.slug}/'
        )
        list_response = self.client.get('/api/schools/schools/')

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(
            detail_response.data['photos_detail'][0]['photo_id'],
            str(photo.photo_id),
        )
        self.assertEqual(len(detail_response.data['videos_detail']), 1)
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data['results'][0]['videos_count'], 1)
        self.assertEqual(
            list_response.data['results'][0]['school_photos'][0]['photo_id'],
            str(photo.photo_id),
        )

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

    def test_home_residential_category_respects_selected_locations_and_combines_boarding_types(self):
        whitefield = Location.objects.create(
            city=self.city,
            location_code='WHF',
            location_name='Whitefield',
            slug='whitefield',
        )
        residential = self.create_school('LOCAL-DAY-BOARDING')
        residential.location = whitefield
        residential.save()
        residential.school_types.add(self.day_boarding)
        full_boarding = self.create_school('LOCAL-FULL-BOARDING')
        full_boarding.location = whitefield
        full_boarding.save()
        full_boarding.school_types.add(self.full_boarding)
        day_school = self.create_school('LOCAL-DAY')
        day_school.location = whitefield
        day_school.save()
        day_school.school_types.add(self.day)
        legacy_school = self.create_school('CITY-BOARDING')
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
            school_code='OTHER-BOARDING',
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
            'city': str(self.city.pk),
            'location': str(whitefield.pk),
            'home_category': 'boarding-schools',
        })
        result = SchoolFilter(params, queryset=School.objects.all())

        self.assertTrue(result.is_valid(), result.errors)
        self.assertSetEqual(
            set(result.qs.values_list('school_code', flat=True)),
            {'LOCAL-DAY-BOARDING', 'LOCAL-FULL-BOARDING', 'CITY-BOARDING'},
        )
        response = self.client.get('/api/schools/schools/', params)
        self.assertEqual(response.status_code, 200)
        self.assertSetEqual(
            {item['school_code'] for item in response.data['results']},
            {'LOCAL-DAY-BOARDING', 'LOCAL-FULL-BOARDING', 'CITY-BOARDING'},
        )
        params['home_category'] = 'residential-school'
        legacy_category = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(legacy_category.is_valid(), legacy_category.errors)
        self.assertSetEqual(
            set(legacy_category.qs.values_list('school_code', flat=True)),
            {'LOCAL-DAY-BOARDING', 'LOCAL-FULL-BOARDING', 'CITY-BOARDING'},
        )

        params['city'] = str(stale_city.pk)
        mismatched_state_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(mismatched_state_scope.is_valid(), mismatched_state_scope.errors)
        self.assertFalse(mismatched_state_scope.qs.exists())

        params.pop('state')
        params.pop('location')
        country_scope = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(country_scope.is_valid(), country_scope.errors)
        self.assertSetEqual(
            set(country_scope.qs.values_list('school_code', flat=True)),
            {'OTHER-BOARDING'},
        )

        params['state'] = str(self.state.pk)
        params['home_category'] = 'day-school'
        params['city'] = str(self.city.pk)
        params['location'] = str(whitefield.pk)
        day_school_result = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(day_school_result.is_valid(), day_school_result.errors)
        self.assertSetEqual(
            set(day_school_result.qs.values_list('school_code', flat=True)),
            {'LOCAL-DAY', 'LOCAL-DAY-BOARDING'},
        )

        params.pop('home_category')
        params['city'] = str(stale_city.pk)
        params['school_type'] = str(self.full_boarding.pk)
        legacy_residential_result = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(legacy_residential_result.is_valid(), legacy_residential_result.errors)
        self.assertSetEqual(
            set(legacy_residential_result.qs.values_list('school_code', flat=True)),
            set(),
        )

        # Existing school-type queries continue to respect location filters.
        params['city'] = str(self.city.pk)
        params['school_type'] = str(self.boarding.pk)
        legacy_filter_result = SchoolFilter(params, queryset=School.objects.all())
        self.assertTrue(legacy_filter_result.is_valid(), legacy_filter_result.errors)
        self.assertSetEqual(
            set(legacy_filter_result.qs.values_list('school_code', flat=True)),
            {'CITY-BOARDING'},
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

    def verification_client(self, role):
        user = User.objects.create_user(
            username=f'verifier-{role.lower()}',
            password='test-password',
            role=role,
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return client, user

    def test_staff_admin_can_change_verification_status_with_audit_note(self):
        school = self.create_school('VERIFY-SCHOOL')
        school.verification_status = 'PENDING'
        school.save(update_fields=['verification_status'])
        client, actor = self.verification_client(User.ROLE_STAFF_ADMIN)

        response = client.post(
            f'/api/schools/schools/{school.pk}/verification/',
            {'status': 'VERIFIED', 'note': 'Ownership documents reviewed.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        school.refresh_from_db()
        self.assertEqual(school.verification_status, 'VERIFIED')
        event = SchoolVerificationEvent.objects.get(school=school)
        self.assertEqual(event.previous_status, 'PENDING')
        self.assertEqual(event.new_status, 'VERIFIED')
        self.assertEqual(event.note, 'Ownership documents reviewed.')
        self.assertEqual(event.actor, actor)

    def test_parent_cannot_access_verification_queue_or_change_status(self):
        school = self.create_school('PRIVATE-VERIFY')
        client, _ = self.verification_client(User.ROLE_PARENT)

        queue_response = client.get(
            '/api/schools/schools/verification-queue/',
        )
        change_response = client.post(
            f'/api/schools/schools/{school.pk}/verification/',
            {'status': 'VERIFIED', 'note': 'Not authorized.'},
            format='json',
        )

        self.assertEqual(queue_response.status_code, 403)
        self.assertEqual(change_response.status_code, 403)
        self.assertFalse(SchoolVerificationEvent.objects.exists())

    def test_verification_change_requires_a_note(self):
        school = self.create_school('VERIFY-NOTE')
        client, _ = self.verification_client(User.ROLE_SUPER_ADMIN)

        response = client.post(
            f'/api/schools/schools/{school.pk}/verification/',
            {'status': 'VERIFIED', 'note': '  '},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        school.refresh_from_db()
        self.assertEqual(school.verification_status, 'UNVERIFIED')
        self.assertFalse(SchoolVerificationEvent.objects.exists())

    def test_generic_school_api_cannot_change_verification_status(self):
        school = self.create_school('VERIFY-API-READONLY')
        user = User.objects.create_user(
            username='school-editor',
            password='test-password',
            role=User.ROLE_STAFF_ADMIN,
        )
        change_school_permission = apps.get_model(
            'auth', 'Permission'
        ).objects.get(codename='change_school')
        user.user_permissions.add(change_school_permission)
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch(
            f'/api/schools/schools/{school.pk}/',
            {'verification_status': 'VERIFIED'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        school.refresh_from_db()
        self.assertEqual(school.verification_status, 'UNVERIFIED')
        self.assertFalse(SchoolVerificationEvent.objects.exists())

    def test_admin_verification_queue_allows_staff_admin_decisions(self):
        school = self.create_school('VERIFY-ADMIN')
        school.verification_status = 'PENDING'
        school.save(update_fields=['verification_status'])
        admin_user = User.objects.create_user(
            username='verification-admin',
            password='test-password',
            role=User.ROLE_STAFF_ADMIN,
            is_staff=True,
        )
        self.client.force_login(admin_user)
        url = reverse('admin:schools_school_verification_queue')

        queue_response = self.client.get(url)
        decision_response = self.client.post(
            url,
            {
                'school_id': str(school.pk),
                'status': 'VERIFIED',
                'note': 'Admin panel documents approved.',
            },
        )

        self.assertEqual(queue_response.status_code, 200)
        self.assertContains(queue_response, school.school_name)
        self.assertEqual(decision_response.status_code, 302)
        school.refresh_from_db()
        self.assertEqual(school.verification_status, 'VERIFIED')
        self.assertEqual(
            SchoolVerificationEvent.objects.get(school=school).actor,
            admin_user,
        )

    def test_admin_verification_queue_rejects_other_staff_roles(self):
        admin_user = User.objects.create_user(
            username='non-verification-admin',
            password='test-password',
            role=User.ROLE_PARENT,
            is_staff=True,
        )
        self.client.force_login(admin_user)

        response = self.client.get(
            reverse('admin:schools_school_verification_queue')
        )

        self.assertEqual(response.status_code, 403)


class CloudinaryUploadTests(SimpleTestCase):
    @patch.dict(
        'os.environ',
        {
            'CLOUDINARY_CLOUD_NAME': 'boardingedu',
            'CLOUDINARY_API_KEY': 'test-key',
            'CLOUDINARY_API_SECRET': 'test-secret',
            'SCHOOL_IMAGE_HOST': 'images.boardingedu.com',
        },
    )
    @patch('apps.schools.cloudinary_uploads.requests.post')
    def test_upload_returns_configured_https_image_host(self, post):
        response = Mock()
        response.ok = True
        response.json.return_value = {
            'secure_url': (
                'https://res.cloudinary.com/boardingedu/image/upload/'
                'v123/boardingedu/schools/school-id/campus-image.jpg'
            ),
        }
        post.return_value = response
        image = SimpleUploadedFile(
            'campus.jpg',
            b'\xff\xd8\xff' + b'valid-image-data',
            content_type='image/jpeg',
        )

        image_url = upload_school_image(
            image,
            school_id='school-id',
            image_kind='campus',
        )

        self.assertEqual(
            image_url,
            'https://images.boardingedu.com/image/upload/'
            'v123/boardingedu/schools/school-id/campus-image.jpg',
        )
        post.assert_called_once()

    @patch('apps.schools.cloudinary_uploads.requests.post')
    def test_invalid_image_is_rejected_without_calling_cloudinary(self, post):
        image = SimpleUploadedFile(
            'campus.png',
            b'not-an-image',
            content_type='image/png',
        )

        with self.assertRaisesRegex(CloudinaryUploadError, 'not a valid'):
            upload_school_image(image, school_id='school-id', image_kind='campus')

        post.assert_not_called()

    @patch.dict('os.environ', {}, clear=True)
    def test_missing_credentials_raise_a_clear_configuration_error(self):
        image = SimpleUploadedFile(
            'campus.png',
            b'\x89PNG\r\n\x1a\n' + b'valid-image-data',
            content_type='image/png',
        )

        with self.assertRaisesRegex(CloudinaryUploadError, 'CLOUDINARY_CLOUD_NAME'):
            upload_school_image(image, school_id='school-id', image_kind='campus')


class SchoolFAQApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = Country.objects.create(
            country_code='IN',
            country_name='India',
            slug='india',
        )
        cls.state = State.objects.create(
            country=cls.country,
            state_code='MH',
            state_name='Maharashtra',
            slug='maharashtra',
        )
        cls.city = City.objects.create(
            state=cls.state,
            city_code='MUM',
            city_name='Mumbai',
            slug='mumbai',
        )
        cls.location = Location.objects.create(
            city=cls.city,
            location_code='SOU',
            location_name='South Mumbai',
            slug='south-mumbai',
        )
        cls.board = Board.objects.create(
            board_code='FAQ-CBSE',
            board_name='CBSE',
            slug='faq-cbse',
        )
        cls.school_type = SchoolType.objects.get(type_code='DAY')
        cls.global_faq = SchoolFAQ.objects.create(
            question='How do I compare schools?',
            answer='Review their profiles.',
            status=True,
        )
        cls.state_faq = SchoolFAQ.objects.create(
            question='Which schools are in Maharashtra?',
            answer='Explore the directory.',
            country=cls.country,
            state=cls.state,
            status=True,
        )
        SchoolFAQ.objects.create(
            question='What is available in South Mumbai?',
            answer='Browse local schools.',
            country=cls.country,
            state=cls.state,
            city=cls.city,
            location=cls.location,
            status=True,
        )
        SchoolFAQ.objects.create(
            question='Unpublished question',
            answer='This should not be public.',
        )

    def test_faq_list_is_public_and_matches_the_requested_scope(self):
        response = self.client.get(
            '/api/schools/faqs/',
            {
                'country': str(self.country.pk),
                'state': str(self.state.pk),
                'board': str(self.board.pk),
                'school_type': str(self.school_type.pk),
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {item['faq_id'] for item in response.data},
            {str(self.global_faq.pk), str(self.state_faq.pk)},
        )

    def test_city_and_locality_faqs_require_matching_scope(self):
        response = self.client.get(
            '/api/schools/faqs/',
            {
                'country': str(self.country.pk),
                'state': str(self.state.pk),
                'city': str(self.city.pk),
                'location': str(self.location.pk),
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)
