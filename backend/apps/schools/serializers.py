import re

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.geography.models import City
from apps.geography.serializers import (
    CountryListSerializer,
    StateListSerializer,
    CityListSerializer,
    LocationListSerializer,
)

from .models import (
    Board,
    SchoolType,
    Grade,
    Facility,
    School,
    SchoolPhoto,
    SchoolVideo,
    SchoolFacility,
    SchoolGrade,
    SchoolFAQ,
)


# ======================================================================
# BOARD
# ======================================================================

class BoardListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = [
            'board_id',
            'board_code',
            'board_name',
            'slug',
            'status',
        ]


class BoardDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = [
            'board_id',
            'board_code',
            'board_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'board_id',
            'slug',
            'created_at',
            'updated_at',
        ]


# ======================================================================
# SCHOOL TYPE
# ======================================================================

class SchoolTypeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolType
        fields = [
            'school_type_id',
            'type_code',
            'type_name',
            'slug',
            'status',
        ]


class SchoolFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolFAQ
        fields = ["faq_id", "question", "answer"]
        read_only_fields = fields


class SchoolTypeDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolType
        fields = [
            'school_type_id',
            'type_code',
            'type_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'school_type_id',
            'slug',
            'created_at',
            'updated_at',
        ]


# ======================================================================
# GRADE
# ======================================================================

class GradeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = [
            'grade_id',
            'grade_code',
            'grade_name',
            'sort_order',
            'status',
        ]


class GradeDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = [
            'grade_id',
            'grade_code',
            'grade_name',
            'sort_order',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'grade_id',
            'created_at',
            'updated_at',
        ]


# ======================================================================
# FACILITY
# ======================================================================

class FacilityListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Facility
        fields = [
            'facility_id',
            'facility_code',
            'category',
            'facility_name',
            'slug',
            'icon_url',
            'status',
        ]


class FacilityDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Facility
        fields = [
            'facility_id',
            'facility_code',
            'category',
            'facility_name',
            'slug',
            'icon_url',
            'description',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'facility_id',
            'slug',
            'created_at',
            'updated_at',
        ]


# ======================================================================
# SCHOOL — LIST
# ======================================================================

class SchoolListSerializer(serializers.ModelSerializer):
    country_id = serializers.UUIDField(
        source='country.country_id',
        read_only=True,
    )
    country_name = serializers.CharField(
        source='country.country_name',
        read_only=True,
    )
    country_slug = serializers.SlugField(
        source='country.slug',
        read_only=True,
    )

    state_id = serializers.UUIDField(
        source='state.state_id',
        read_only=True,
    )
    state_name = serializers.CharField(
        source='state.state_name',
        read_only=True,
    )
    state_slug = serializers.SlugField(
        source='state.slug',
        read_only=True,
    )

    city_id = serializers.UUIDField(
        source='city.city_id',
        read_only=True,
    )
    city_name = serializers.CharField(
        source='city.city_name',
        read_only=True,
    )
    city_slug = serializers.SlugField(
        source='city.slug',
        read_only=True,
    )

    location_id = serializers.UUIDField(
        source='location.location_id',
        read_only=True,
        allow_null=True,
    )
    location_name = serializers.CharField(
        source='location.location_name',
        read_only=True,
        allow_null=True,
    )
    location_slug = serializers.SlugField(
        source='location.slug',
        read_only=True,
        allow_null=True,
    )

    boards_detail = BoardListSerializer(source='boards', many=True, read_only=True)
    school_types_detail = SchoolTypeListSerializer(
        source='school_types',
        many=True,
        read_only=True,
    )
    board_id = serializers.SerializerMethodField()
    board_name = serializers.SerializerMethodField()
    school_type_id = serializers.SerializerMethodField()
    school_type_name = serializers.SerializerMethodField()

    gender = serializers.CharField(
        source='get_gender_display',
        read_only=True,
    )
    verification_status = serializers.CharField(
        source='get_verification_status_display',
        read_only=True,
    )
    annual_fee = serializers.SerializerMethodField()
    school_photos = serializers.SerializerMethodField()
    videos_count = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    academics_rating = serializers.FloatField(read_only=True, allow_null=True)
    facilities_rating = serializers.FloatField(read_only=True, allow_null=True)
    safety_rating = serializers.FloatField(read_only=True, allow_null=True)
    communication_rating = serializers.FloatField(read_only=True, allow_null=True)
    grades_range = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            'school_id',
            'school_code',
            'school_name',
            'short_name',
            'school_logo_url',
            'school_image_url',
            'school_photos',
            'videos_count',
            'slug',
            'average_rating',
            'review_count',
            'academics_rating',
            'facilities_rating',
            'safety_rating',
            'communication_rating',
            'grades_range',

            'country_id',
            'country_name',
            'country_slug',

            'state_id',
            'state_name',
            'state_slug',

            'city_id',
            'city_name',
            'city_slug',

            'location_id',
            'location_name',
            'location_slug',

            'boards_detail',
            'school_types_detail',
            'board_id',
            'board_name',

            'school_type_id',
            'school_type_name',
            'annual_fee',

            'gender',
            'verification_status',

            'pincode',
            'address',
            'lat',
            'lng',
            'phone',
            'email',
            'principal_name',
            'established_year',
            'boarding_required',
            'is_featured',
            'status',
            'published_at',
        ]

        read_only_fields = [
            'school_id',
            'slug',
            'published_at',
        ]

    def _first_classifications(self, obj):
        boards = list(obj.boards.all())
        school_types = list(obj.school_types.all())
        return (boards[0] if boards else None, school_types[0] if school_types else None)

    def get_board_id(self, obj):
        board, _ = self._first_classifications(obj)
        return str(board.board_id) if board else None

    def get_board_name(self, obj):
        board, _ = self._first_classifications(obj)
        return board.board_name if board else None

    def get_school_type_id(self, obj):
        _, school_type = self._first_classifications(obj)
        return str(school_type.school_type_id) if school_type else None

    def get_school_type_name(self, obj):
        _, school_type = self._first_classifications(obj)
        return school_type.type_name if school_type else None

    def get_annual_fee(self, obj):
        return getattr(obj, 'annual_fee', None)

    def get_school_photos(self, obj):
        photos = getattr(obj, 'active_photos', None)
        if photos is None:
            photos = obj.photos.filter(status=True).order_by(
                'sort_order',
                'created_at',
            )
        return SchoolPhotoListSerializer(photos[:3], many=True).data

    def get_videos_count(self, obj):
        videos = getattr(obj, 'active_videos', None)
        if videos is not None:
            return len(videos)
        return obj.videos.filter(status=True).count()

    def get_average_rating(self, obj):
        value = getattr(obj, 'average_rating', None)
        return round(float(value), 1) if value is not None else None

    def get_review_count(self, obj):
        value = getattr(obj, 'review_count', None)
        return int(value) if value is not None else 0

    def get_grades_range(self, obj):
        """Human readable class range, e.g. "LKG - 12".

        Uses the ``school_grades`` prefetch so the listing stays at one query.
        """
        school_grades = getattr(obj, 'school_grades', None)
        if school_grades is None:
            return None
        grades = [
            item.grade
            for item in school_grades.all()
            if getattr(item, 'is_active', True) and item.grade is not None
        ]
        if not grades:
            return None
        # sort_order is the canonical ordering for classes (LKG, UKG, 1..12).
        first = min(grades, key=lambda grade: (grade.sort_order, grade.grade_name))
        last = max(grades, key=lambda grade: (grade.sort_order, grade.grade_name))
        if first.grade_name == last.grade_name:
            return first.grade_name
        return f"{first.grade_name} - {last.grade_name}"


class SchoolPhotoListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolPhoto
        fields = [
            'photo_id',
            'photo_url',
            'caption',
            'alt_text',
            'category',
            'sort_order',
        ]


class SchoolVideoListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolVideo
        fields = [
            'video_id',
            'video_url',
            'thumbnail_url',
            'caption',
            'category',
            'sort_order',
        ]


# ======================================================================
# SCHOOL — DETAIL
# ======================================================================

class SchoolDetailSerializer(serializers.ModelSerializer):
    is_featured = serializers.BooleanField(read_only=True)

    country_detail = CountryListSerializer(
        source='country',
        read_only=True,
    )
    state_detail = StateListSerializer(
        source='state',
        read_only=True,
    )
    city_detail = CityListSerializer(
        source='city',
        read_only=True,
    )
    location_detail = LocationListSerializer(
        source='location',
        read_only=True,
        allow_null=True,
    )
    boards = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Board.objects.all(),
        allow_empty=False,
        required=False,
    )
    school_types = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=SchoolType.objects.all(),
        allow_empty=False,
        required=False,
    )
    boards_detail = BoardListSerializer(source='boards', many=True, read_only=True)
    school_types_detail = SchoolTypeListSerializer(
        source='school_types',
        many=True,
        read_only=True,
    )
    board = serializers.SerializerMethodField()
    board_detail = serializers.SerializerMethodField()
    school_type = serializers.SerializerMethodField()
    school_type_detail = serializers.SerializerMethodField()

    grades_offered_detail = serializers.SerializerMethodField()
    facilities_detail = serializers.SerializerMethodField()
    photos_detail = serializers.SerializerMethodField()
    videos_detail = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            'school_id',
            'school_code',
            'school_name',
            'short_name',
            'school_logo_url',
            'school_image_url',
            'slug',
            'average_rating',
            'review_count',

            'country',
            'country_detail',
            'state',
            'state_detail',
            'city',
            'city_detail',
            'location',
            'location_detail',

            'boards',
            'boards_detail',
            'school_types',
            'school_types_detail',
            'board',
            'board_detail',
            'school_type',
            'school_type_detail',

            'gender',
            'established_year',
            'pincode',
            'address',
            'lat',
            'lng',
            'phone',
            'email',
            'principal_name',
            'boarding_required',
            'is_featured',
            'status',
            'verification_status',
            'published_at',
            'created_at',
            'updated_at',

            'grades_offered_detail',
            'facilities_detail',
            'photos_detail',
            'videos_detail',
        ]

        read_only_fields = [
            'school_id',
            'slug',
            'verification_status',
            'published_at',
            'created_at',
            'updated_at',
        ]

    def to_internal_value(self, data):
        data = data.copy()
        if 'boards' not in data and 'board' in data:
            data['boards'] = [data['board']]
        if 'school_types' not in data and 'school_type' in data:
            data['school_types'] = [data['school_type']]
        return super().to_internal_value(data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not getattr(self, 'partial', False):
            for field in ('boards', 'school_types'):
                if field not in attrs:
                    raise serializers.ValidationError({
                        field: 'At least one value is required.'
                    })
        return attrs

    def _first_classifications(self, obj):
        boards = list(obj.boards.all())
        school_types = list(obj.school_types.all())
        return (boards[0] if boards else None, school_types[0] if school_types else None)

    def get_board(self, obj):
        board, _ = self._first_classifications(obj)
        return str(board.board_id) if board else None

    def get_board_detail(self, obj):
        board, _ = self._first_classifications(obj)
        return BoardListSerializer(board).data if board else None

    def get_school_type(self, obj):
        _, school_type = self._first_classifications(obj)
        return str(school_type.school_type_id) if school_type else None

    def get_school_type_detail(self, obj):
        _, school_type = self._first_classifications(obj)
        return SchoolTypeListSerializer(school_type).data if school_type else None

    def get_grades_offered_detail(self, obj):
        """Return active grades offered by the school."""

        grades = getattr(
            obj,
            '_prefetched_school_grades',
            None,
        )

        if grades is None:
            grades = (
                obj.school_grades
                .filter(is_active=True)
                .select_related('grade')
                .order_by('grade__sort_order')
            )

        result = []

        for school_grade in grades:
            if not school_grade.is_active:
                continue

            grade = school_grade.grade

            result.append({
                'school_grade_id': str(
                    school_grade.school_grade_id
                ),
                'grade_id': str(grade.grade_id),
                'grade_code': grade.grade_code,
                'grade_name': grade.grade_name,
                'sort_order': grade.sort_order,
                'seats_available': school_grade.seats_available,
                'entry_age_min': school_grade.entry_age_min,
                'entry_age_max': school_grade.entry_age_max,
            })

        return result

    def get_facilities_detail(self, obj):
        """Return facilities currently available at the school."""

        facilities = getattr(
            obj,
            '_prefetched_school_facilities',
            None,
        )

        if facilities is None:
            facilities = (
                obj.school_facilities
                .filter(available=True)
                .select_related('facility')
                .order_by(
                    'facility__category',
                    'facility__facility_name',
                )
            )

        result = []

        for school_facility in facilities:
            if not school_facility.available:
                continue

            facility = school_facility.facility

            result.append({
                'school_facility_id': str(
                    school_facility.school_facility_id
                ),
                'facility_id': str(facility.facility_id),
                'facility_code': facility.facility_code,
                'facility_name': facility.facility_name,
                'category': facility.category,
                'icon_url': facility.icon_url or None,
                'quantity_or_capacity': (
                    school_facility.quantity_or_capacity
                ),
                'description': school_facility.description or None,
            })

        return result

    def get_photos_detail(self, obj):
        photos = getattr(obj, 'active_photos', None)
        if photos is None:
            photos = obj.photos.filter(status=True).order_by(
                'sort_order',
                'created_at',
            )
        return SchoolPhotoListSerializer(photos, many=True).data

    def get_videos_detail(self, obj):
        videos = getattr(obj, 'active_videos', None)
        if videos is None:
            videos = obj.videos.filter(status=True).order_by(
                'sort_order',
                'created_at',
            )
        return SchoolVideoListSerializer(videos, many=True).data

    def get_average_rating(self, obj):
        value = getattr(obj, 'average_rating', None)
        return round(float(value), 1) if value is not None else None

    def get_review_count(self, obj):
        value = getattr(obj, 'review_count', None)
        return int(value) if value is not None else 0


# ======================================================================
# SCHOOL FACILITY — LIST
# ======================================================================

class SchoolFacilityListSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(
        source='school.school_name',
        read_only=True,
    )
    facility_name = serializers.CharField(
        source='facility.facility_name',
        read_only=True,
    )
    category = serializers.CharField(
        source='facility.category',
        read_only=True,
    )

    class Meta:
        model = SchoolFacility
        fields = [
            'school_facility_id',
            'school',
            'school_name',
            'facility',
            'facility_name',
            'category',
            'available',
            'quantity_or_capacity',
            'description',
        ]


# ======================================================================
# SCHOOL FACILITY — DETAIL
# ======================================================================

class SchoolFacilityDetailSerializer(serializers.ModelSerializer):
    school_detail = SchoolListSerializer(
        source='school',
        read_only=True,
    )
    facility_detail = FacilityListSerializer(
        source='facility',
        read_only=True,
    )

    class Meta:
        model = SchoolFacility
        fields = [
            'school_facility_id',
            'school',
            'school_detail',
            'facility',
            'facility_detail',
            'available',
            'quantity_or_capacity',
            'description',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'school_facility_id',
            'created_at',
            'updated_at',
        ]


# ======================================================================
# SCHOOL GRADE — LIST
# ======================================================================

class SchoolGradeListSerializer(serializers.ModelSerializer):
    school_id = serializers.UUIDField(
        source='school.school_id',
        read_only=True,
    )
    school_code = serializers.CharField(
        source='school.school_code',
        read_only=True,
    )
    school_name = serializers.CharField(
        source='school.school_name',
        read_only=True,
    )

    grade_id = serializers.UUIDField(
        source='grade.grade_id',
        read_only=True,
    )
    grade_code = serializers.CharField(
        source='grade.grade_code',
        read_only=True,
    )
    grade_name = serializers.CharField(
        source='grade.grade_name',
        read_only=True,
    )
    sort_order = serializers.IntegerField(
        source='grade.sort_order',
        read_only=True,
    )

    class Meta:
        model = SchoolGrade
        fields = [
            'school_grade_id',
            'school_id',
            'school_code',
            'school_name',
            'grade_id',
            'grade_code',
            'grade_name',
            'sort_order',
            'seats_available',
            'entry_age_min',
            'entry_age_max',
            'is_active',
        ]


# ======================================================================
# SCHOOL GRADE — DETAIL
# ======================================================================

class SchoolGradeDetailSerializer(serializers.ModelSerializer):
    school_detail = SchoolListSerializer(
        source='school',
        read_only=True,
    )
    grade_detail = GradeListSerializer(
        source='grade',
        read_only=True,
    )

    class Meta:
        model = SchoolGrade
        fields = [
            'school_grade_id',
            'school',
            'school_detail',
            'grade',
            'grade_detail',
            'seats_available',
            'entry_age_min',
            'entry_age_max',
            'is_active',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'school_grade_id',
            'created_at',
            'updated_at',
        ]


# ======================================================================
# SCHOOL SELF-REGISTRATION (public onboarding)
# Creates a PENDING school + its SCHOOL_ADMIN login in one atomic step.
# The account stays unusable until a staff/super admin verifies the school.
# ======================================================================

def next_school_code() -> str:
    """Sequential school code, e.g. SCH0001."""
    codes = School.objects.filter(school_code__regex=r'^SCH\d+$').values_list(
        'school_code', flat=True
    )
    highest = max((int(code[3:]) for code in codes), default=0)
    return f'SCH{highest + 1:04d}'


class SchoolRegistrationSerializer(serializers.Serializer):
    """Public school sign-up → pending School + pending SCHOOL_ADMIN user."""

    # ---- School profile ----
    school_name = serializers.CharField(max_length=255)
    city = serializers.UUIDField()
    address = serializers.CharField(max_length=500)
    pincode = serializers.CharField(max_length=20, required=False, allow_blank=True)
    school_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    school_email = serializers.EmailField(required=False, allow_blank=True)
    established_year = serializers.IntegerField(required=False, allow_null=True)
    gender = serializers.ChoiceField(
        choices=[choice[0] for choice in School.GENDER_CHOICES],
        required=False,
        default='COED',
    )
    boards = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    school_types = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )

    # ---- Primary contact / login credentials ----
    contact_full_name = serializers.CharField(max_length=150)
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=17)
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(min_length=8, write_only=True)

    def validate_email(self, value):
        User = get_user_model()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                'An account with this email address already exists.'
            )
        return value

    def validate_username(self, value):
        User = get_user_model()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_phone(self, value):
        digits = re.sub(r'\D', '', value or '')
        if not 9 <= len(digits) <= 15:
            raise serializers.ValidationError(
                'Enter a phone number with 9 to 15 digits, e.g. +919999999999.'
            )
        return value

    def validate_city(self, value):
        try:
            return City.objects.select_related('state__country').get(
                pk=value, status=True
            )
        except City.DoesNotExist:
            raise serializers.ValidationError('Choose a valid city.')

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError(
                {'password_confirm': 'Passwords do not match.'}
            )
        if data.get('established_year') and not (
            1800 <= data['established_year'] <= 2100
        ):
            raise serializers.ValidationError(
                {'established_year': 'Enter a year between 1800 and 2100.'}
            )

        boards = Board.objects.filter(pk__in=data.get('boards') or [])
        school_types = SchoolType.objects.filter(
            pk__in=data.get('school_types') or []
        )
        if data.get('boards') and boards.count() != len(set(data['boards'])):
            raise serializers.ValidationError({'boards': 'Choose valid boards.'})
        if data.get('school_types') and school_types.count() != len(
            set(data['school_types'])
        ):
            raise serializers.ValidationError(
                {'school_types': 'Choose valid school types.'}
            )
        data['_boards'] = list(boards)
        data['_school_types'] = list(school_types)
        return data

    @transaction.atomic
    def create(self, validated_data):
        User = get_user_model()
        from apps.users.models import SchoolAdminProfile

        city = validated_data['city']
        contact_name = validated_data['contact_full_name'].strip()
        first_name, _, last_name = contact_name.partition(' ')

        school = School.objects.create(
            school_code=next_school_code(),
            school_name=validated_data['school_name'].strip(),
            country=city.state.country,
            state=city.state,
            city=city,
            address=validated_data['address'].strip(),
            pincode=validated_data.get('pincode', ''),
            phone=validated_data.get('school_phone', ''),
            email=validated_data.get('school_email', ''),
            established_year=validated_data.get('established_year'),
            gender=validated_data.get('gender', 'COED'),
            principal_name=contact_name[:100],
            # Not publicly visible until an admin verifies the school.
            status=False,
            verification_status='PENDING',
        )
        school.boards.set(validated_data['_boards'])
        school.school_types.set(validated_data['_school_types'])

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name,
            phone=validated_data['phone'],
            role=User.ROLE_SCHOOL_ADMIN,
        )
        SchoolAdminProfile.objects.create(
            user=user,
            school=school,
            designation=validated_data.get('designation', ''),
        )
        return school
