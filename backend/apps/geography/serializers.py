from rest_framework import serializers

from .models import Country, State, City, Location


class CountryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = [
            'country_id',
            'country_code',
            'country_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'country_id',
            'slug',
            'created_at',
            'updated_at',
        ]


class StateListSerializer(serializers.ModelSerializer):
    country_id = serializers.CharField(source='country.country_id', read_only=True)
    country_code = serializers.CharField(source='country.country_code', read_only=True)
    country_name = serializers.CharField(source='country.country_name', read_only=True)

    class Meta:
        model = State
        fields = [
            'state_id',
            'country_id',
            'country_code',
            'country_name',
            'state_code',
            'state_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'state_id',
            'slug',
            'created_at',
            'updated_at',
        ]


class CityListSerializer(serializers.ModelSerializer):
    state_id = serializers.CharField(source='state.state_id', read_only=True)
    state_code = serializers.CharField(source='state.state_code', read_only=True)
    state_name = serializers.CharField(source='state.state_name', read_only=True)
    country_id = serializers.CharField(source='state.country.country_id', read_only=True)
    country_code = serializers.CharField(source='state.country.country_code', read_only=True)
    country_name = serializers.CharField(source='state.country.country_name', read_only=True)

    class Meta:
        model = City
        fields = [
            'city_id',
            'state_id',
            'state_code',
            'state_name',
            'country_id',
            'country_code',
            'country_name',
            'city_code',
            'city_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'city_id',
            'slug',
            'created_at',
            'updated_at',
        ]


class LocationListSerializer(serializers.ModelSerializer):
    city_id = serializers.CharField(source='city.city_id', read_only=True)
    city_code = serializers.CharField(source='city.city_code', read_only=True)
    city_name = serializers.CharField(source='city.city_name', read_only=True)
    state_id = serializers.CharField(source='city.state.state_id', read_only=True)
    state_code = serializers.CharField(source='city.state.state_code', read_only=True)
    state_name = serializers.CharField(source='city.state.state_name', read_only=True)
    country_id = serializers.CharField(source='city.state.country.country_id', read_only=True)
    country_code = serializers.CharField(source='city.state.country.country_code', read_only=True)
    country_name = serializers.CharField(source='city.state.country.country_name', read_only=True)

    class Meta:
        model = Location
        fields = [
            'location_id',
            'city_id',
            'city_code',
            'city_name',
            'state_id',
            'state_code',
            'state_name',
            'country_id',
            'country_code',
            'country_name',
            'location_code',
            'location_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'location_id',
            'slug',
            'created_at',
            'updated_at',
        ]


class LocationDetailSerializer(serializers.ModelSerializer):
    city_detail = CityListSerializer(source='city', read_only=True)

    class Meta:
        model = Location
        fields = [
            'location_id',
            'city',
            'city_detail',
            'location_code',
            'location_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'location_id',
            'slug',
            'created_at',
            'updated_at',
        ]


class CityDetailSerializer(serializers.ModelSerializer):
    state_detail = StateListSerializer(source='state', read_only=True)
    locations_detail = LocationListSerializer(source='locations', read_only=True, many=True)

    class Meta:
        model = City
        fields = [
            'city_id',
            'state',
            'state_detail',
            'city_code',
            'city_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
            'locations_detail',
        ]
        read_only_fields = [
            'city_id',
            'slug',
            'created_at',
            'updated_at',
        ]


class StateDetailSerializer(serializers.ModelSerializer):
    country_detail = CountryListSerializer(source='country', read_only=True)
    cities_detail = CityListSerializer(source='cities', read_only=True, many=True)

    class Meta:
        model = State
        fields = [
            'state_id',
            'country',
            'country_detail',
            'state_code',
            'state_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
            'cities_detail',
        ]
        read_only_fields = [
            'state_id',
            'slug',
            'created_at',
            'updated_at',
        ]


class CountryDetailSerializer(serializers.ModelSerializer):
    states_detail = StateListSerializer(source='states', read_only=True, many=True)

    class Meta:
        model = Country
        fields = [
            'country_id',
            'country_code',
            'country_name',
            'slug',
            'status',
            'created_at',
            'updated_at',
            'states_detail',
        ]
        read_only_fields = [
            'country_id',
            'slug',
            'created_at',
            'updated_at',
        ]
