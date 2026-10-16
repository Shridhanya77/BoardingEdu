from rest_framework import serializers

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
    SchoolFacility,
    SchoolGrade,
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


class SchoolPhotoListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolPhoto
        fields = ['photo_id', 'photo_url', 'caption', 'alt_text', 'sort_order']


# ======================================================================
# SCHOOL — DETAIL
# ======================================================================

class SchoolDetailSerializer(serializers.ModelSerializer):
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
            'status',
            'verification_status',
            'published_at',
            'created_at',
            'updated_at',

            'grades_offered_detail',
            'facilities_detail',
            'photos_detail',
        ]

        read_only_fields = [
            'school_id',
            'slug',
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
