from rest_framework import serializers
from apps.geography.serializers import (
    CountryListSerializer,
    StateListSerializer,
    CityListSerializer,
    LocationListSerializer,
)
from .models import Board, SchoolType, Grade, Facility, School, SchoolFacility


# ---------- Board ----------
class BoardListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = ['board_id', 'board_code', 'board_name', 'slug', 'status']


class BoardDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = [
            'board_id', 'board_code', 'board_name', 'slug',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['board_id', 'slug', 'created_at', 'updated_at']


# ---------- SchoolType ----------
class SchoolTypeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolType
        fields = ['school_type_id', 'type_code', 'type_name', 'slug', 'status']


class SchoolTypeDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolType
        fields = [
            'school_type_id', 'type_code', 'type_name', 'slug',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['school_type_id', 'slug', 'created_at', 'updated_at']


# ---------- Grade ----------
class GradeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ['grade_id', 'grade_code', 'grade_name', 'sort_order', 'status']


class GradeDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = [
            'grade_id', 'grade_code', 'grade_name', 'sort_order',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['grade_id', 'created_at', 'updated_at']


# ---------- Facility ----------
class FacilityListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Facility
        fields = [
            'facility_id', 'facility_code', 'category', 'facility_name',
            'slug', 'icon_url', 'status',
        ]


class FacilityDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Facility
        fields = [
            'facility_id', 'facility_code', 'category', 'facility_name',
            'slug', 'icon_url', 'description',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['facility_id', 'slug', 'created_at', 'updated_at']


# ---------- School ----------
class SchoolListSerializer(serializers.ModelSerializer):
    country_id = serializers.UUIDField(source='country.country_id', read_only=True)
    country_name = serializers.CharField(source='country.country_name', read_only=True)
    state_id = serializers.UUIDField(source='state.state_id', read_only=True)
    state_name = serializers.CharField(source='state.state_name', read_only=True)
    city_id = serializers.UUIDField(source='city.city_id', read_only=True)
    city_name = serializers.CharField(source='city.city_name', read_only=True)
    location_id = serializers.UUIDField(source='location.location_id', read_only=True, allow_null=True)
    location_name = serializers.CharField(source='location.location_name', read_only=True, allow_null=True)
    board_id = serializers.UUIDField(source='board.board_id', read_only=True)
    board_name = serializers.CharField(source='board.board_name', read_only=True)
    school_type_id = serializers.UUIDField(source='school_type.school_type_id', read_only=True)
    school_type_name = serializers.CharField(source='school_type.type_name', read_only=True)
    gender = serializers.CharField(source='get_gender_display', read_only=True)
    verification_status = serializers.CharField(source='get_verification_status_display', read_only=True)

    class Meta:
        model = School
        fields = [
            'school_id', 'school_code', 'school_name', 'short_name', 'slug',
            'country_id', 'country_name',
            'state_id', 'state_name',
            'city_id', 'city_name',
            'location_id', 'location_name',
            'board_id', 'board_name',
            'school_type_id', 'school_type_name',
            'gender', 'verification_status',
            'pincode', 'address', 'lat', 'lng',
            'phone', 'email', 'principal_name', 'established_year',
            'boarding_required', 'status', 'published_at',
        ]
        read_only_fields = [
            'school_id', 'slug', 'published_at',
        ]


class SchoolDetailSerializer(serializers.ModelSerializer):
    country_detail = CountryListSerializer(source='country', read_only=True)
    state_detail = StateListSerializer(source='state', read_only=True)
    city_detail = CityListSerializer(source='city', read_only=True)
    location_detail = LocationListSerializer(source='location', read_only=True, allow_null=True)
    board_detail = BoardListSerializer(source='board', read_only=True)
    school_type_detail = SchoolTypeListSerializer(source='school_type', read_only=True)

    class Meta:
        model = School
        fields = [
            'school_id', 'school_code', 'school_name', 'short_name', 'slug',
            'country', 'country_detail',
            'state', 'state_detail',
            'city', 'city_detail',
            'location', 'location_detail',
            'board', 'board_detail',
            'school_type', 'school_type_detail',
            'gender', 'established_year', 'pincode', 'address',
            'lat', 'lng', 'phone', 'email', 'principal_name',
            'boarding_required', 'status', 'verification_status', 'published_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'school_id', 'slug', 'published_at', 'created_at', 'updated_at',
        ]


# ---------- SchoolFacility ----------
class SchoolFacilityListSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.school_name', read_only=True)
    facility_name = serializers.CharField(source='facility.facility_name', read_only=True)
    category = serializers.CharField(source='facility.category', read_only=True)

    class Meta:
        model = SchoolFacility
        fields = [
            'school_facility_id', 'school', 'school_name',
            'facility', 'facility_name', 'category',
            'available', 'quantity_or_capacity', 'description',
        ]


class SchoolFacilityDetailSerializer(serializers.ModelSerializer):
    school_detail = SchoolListSerializer(source='school', read_only=True)
    facility_detail = FacilityListSerializer(source='facility', read_only=True)

    class Meta:
        model = SchoolFacility
        fields = [
            'school_facility_id',
            'school', 'school_detail',
            'facility', 'facility_detail',
            'available', 'quantity_or_capacity', 'description',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['school_facility_id', 'created_at', 'updated_at']
