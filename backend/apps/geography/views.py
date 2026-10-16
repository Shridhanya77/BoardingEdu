from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Q

from .models import Country, State, City, Location
from .serializers import (
    CountryListSerializer,
    CountryDetailSerializer,
    StateListSerializer,
    StateDetailSerializer,
    CityListSerializer,
    CityDetailSerializer,
    LocationListSerializer,
    LocationDetailSerializer,
)


class ReadWriteModelViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    def get_serializer_class(self):
        if self.action in ('list',) and hasattr(self, 'list_serializer_class'):
            return self.list_serializer_class
        return self.serializer_class


class CountryViewSet(ReadWriteModelViewSet):
    queryset = Country.objects.all()
    serializer_class = CountryDetailSerializer
    list_serializer_class = CountryListSerializer
    filterset_fields = ['country_code', 'status']
    search_fields = ['country_name', 'country_code']
    ordering_fields = ['country_name', 'country_code', 'created_at']
    ordering = ['country_name']

    @action(
        detail=True,
        methods=['get'],
        filter_backends=[DjangoFilterBackend, SearchFilter],
    )
    def states(self, request, pk=None):
        country = self.get_object()
        queryset = country.states.select_related('country').all()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = StateListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = StateListSerializer(queryset, many=True)
        return Response(serializer.data)


class StateViewSet(ReadWriteModelViewSet):
    queryset = State.objects.select_related('country').all()
    serializer_class = StateDetailSerializer
    list_serializer_class = StateListSerializer
    filterset_fields = ['country', 'state_code', 'status']
    search_fields = ['state_name', 'state_code']
    ordering_fields = ['state_name', 'state_code', 'created_at']
    ordering = ['state_name']

    @action(
        detail=True,
        methods=['get'],
        filter_backends=[DjangoFilterBackend, SearchFilter],
    )
    def cities(self, request, pk=None):
        state = self.get_object()
        queryset = state.cities.select_related('state', 'state__country').all()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = CityListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = CityListSerializer(queryset, many=True)
        return Response(serializer.data)


class CityViewSet(ReadWriteModelViewSet):
    queryset = City.objects.select_related('state', 'state__country').annotate(
        schools_count=Count('schools', filter=Q(schools__status=True), distinct=True)
    )
    serializer_class = CityDetailSerializer
    list_serializer_class = CityListSerializer
    filterset_fields = ['state', 'state__country', 'city_code', 'status']
    search_fields = ['city_name', 'city_code']
    ordering_fields = ['city_name', 'city_code', 'created_at']
    ordering = ['city_name']

    @action(
        detail=True,
        methods=['get'],
        filter_backends=[DjangoFilterBackend, SearchFilter],
    )
    def locations(self, request, pk=None):
        city = self.get_object()
        queryset = city.locations.select_related('city', 'city__state', 'city__state__country').all()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = LocationListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = LocationListSerializer(queryset, many=True)
        return Response(serializer.data)


class LocationViewSet(ReadWriteModelViewSet):
    queryset = Location.objects.select_related('city', 'city__state', 'city__state__country').all()
    serializer_class = LocationDetailSerializer
    list_serializer_class = LocationListSerializer
    filterset_fields = ['city', 'city__state', 'city__state__country', 'location_code', 'status']
    search_fields = ['location_name', 'location_code']
    ordering_fields = ['location_name', 'location_code', 'created_at']
    ordering = ['location_name']
