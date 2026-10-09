from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Board, SchoolType, Grade, Facility, School, SchoolFacility
from .serializers import (
    BoardDetailSerializer, BoardListSerializer,
    SchoolTypeDetailSerializer, SchoolTypeListSerializer,
    GradeDetailSerializer, GradeListSerializer,
    FacilityDetailSerializer, FacilityListSerializer,
    SchoolDetailSerializer, SchoolListSerializer,
    SchoolFacilityDetailSerializer, SchoolFacilityListSerializer,
)


class ReadWriteModelViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_serializer_class(self):
        if self.action in ('list',) and hasattr(self, 'list_serializer_class'):
            return self.list_serializer_class
        return self.serializer_class


# ---------- Board ----------
class BoardViewSet(ReadWriteModelViewSet):
    queryset = Board.objects.all()
    serializer_class = BoardDetailSerializer
    list_serializer_class = BoardListSerializer
    search_fields = ['board_code', 'board_name', 'slug']
    filterset_fields = ['status']
    ordering_fields = ['board_name', 'board_code', 'created_at']
    ordering = ['board_name']


# ---------- SchoolType ----------
class SchoolTypeViewSet(ReadWriteModelViewSet):
    queryset = SchoolType.objects.all()
    serializer_class = SchoolTypeDetailSerializer
    list_serializer_class = SchoolTypeListSerializer
    search_fields = ['type_code', 'type_name', 'slug']
    filterset_fields = ['status']
    ordering_fields = ['type_name', 'type_code', 'created_at']
    ordering = ['type_name']


# ---------- Grade ----------
class GradeViewSet(ReadWriteModelViewSet):
    queryset = Grade.objects.all()
    serializer_class = GradeDetailSerializer
    list_serializer_class = GradeListSerializer
    search_fields = ['grade_code', 'grade_name']
    filterset_fields = ['status']
    ordering_fields = ['sort_order', 'grade_name', 'grade_code', 'created_at']
    ordering = ['sort_order']


# ---------- Facility ----------
class FacilityViewSet(ReadWriteModelViewSet):
    queryset = Facility.objects.all()
    serializer_class = FacilityDetailSerializer
    list_serializer_class = FacilityListSerializer
    search_fields = ['facility_code', 'facility_name', 'category', 'slug']
    filterset_fields = ['status', 'category']
    ordering_fields = ['category', 'facility_name', 'facility_code', 'created_at']
    ordering = ['category', 'facility_name']


# ---------- School ----------
class SchoolViewSet(ReadWriteModelViewSet):
    queryset = School.objects.select_related(
        'country', 'state', 'city', 'location', 'board', 'school_type'
    ).all()
    serializer_class = SchoolDetailSerializer
    list_serializer_class = SchoolListSerializer
    filterset_fields = [
        'country', 'state', 'city', 'location',
        'board', 'school_type',
        'gender', 'status', 'verification_status', 'boarding_required',
    ]
    search_fields = [
        'school_code', 'school_name', 'short_name', 'slug',
        'address', 'pincode', 'phone', 'email',
        'city__city_name', 'board__board_name',
    ]
    ordering_fields = [
        'school_name', 'school_code', 'established_year',
        'created_at', 'published_at',
    ]
    ordering = ['school_name']


# ---------- SchoolFacility ----------
class SchoolFacilityViewSet(ReadWriteModelViewSet):
    queryset = SchoolFacility.objects.select_related(
        'school', 'facility'
    ).all()
    serializer_class = SchoolFacilityDetailSerializer
    list_serializer_class = SchoolFacilityListSerializer
    search_fields = [
        'school__school_code', 'school__school_name',
        'facility__facility_name', 'facility__category',
    ]
    filterset_fields = ['school', 'facility', 'available', 'facility__category']
    ordering_fields = ['school__school_name', 'facility__category', 'facility__facility_name', 'created_at']
    ordering = ['school__school_name', 'facility__category', 'facility__facility_name']
