from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import AcademicYear, FeeTerm, FeeStructure, FeeItem
from .serializers import (
    AcademicYearSerializer, AcademicYearListSerializer,
    FeeTermSerializer, FeeTermListSerializer,
    FeeStructureSerializer, FeeStructureListSerializer,
    FeeItemSerializer, FeeItemListSerializer,
)


class ReadWriteModelViewSet(viewsets.ModelViewSet):
    """Base: split serializers for LIST vs detail operations."""
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_serializer_class(self):
        if self.action in ('list',) and hasattr(self, 'list_serializer_class'):
            return self.list_serializer_class
        return self.serializer_class


class AcademicYearViewSet(ReadWriteModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    list_serializer_class = AcademicYearListSerializer
    search_fields = ['year_code', 'year_name']
    filterset_fields = ['is_current', 'status']
    ordering_fields = ['year_name', 'year_code', 'start_date', 'created_at']
    ordering = ['-start_date']


class FeeTermViewSet(ReadWriteModelViewSet):
    queryset = FeeTerm.objects.select_related('academic_year').all()
    serializer_class = FeeTermSerializer
    list_serializer_class = FeeTermListSerializer
    search_fields = ['term_code', 'term_name', 'academic_year__year_code', 'academic_year__year_name']
    filterset_fields = ['status', 'academic_year', 'term_frequency']
    ordering_fields = ['term_name', 'term_code', 'start_date', 'created_at']
    ordering = ['academic_year__start_date', 'start_date']


class FeeStructureViewSet(ReadWriteModelViewSet):
    queryset = FeeStructure.objects.select_related(
        'school', 'academic_year', 'payment_terms'
    ).all()
    serializer_class = FeeStructureSerializer
    list_serializer_class = FeeStructureListSerializer
    filterset_fields = ['school', 'academic_year', 'status', 'published']
    search_fields = [
        'structure_code', 'structure_name',
        'school__school_name', 'school__school_code',
    ]
    ordering_fields = [
        'structure_name', 'structure_code', 'effective_from',
        'created_at', 'published_at',
    ]
    ordering = ['-created_at']


class FeeItemViewSet(ReadWriteModelViewSet):
    queryset = FeeItem.objects.select_related(
        'fee_structure', 'grade', 'school_type'
    ).all()
    serializer_class = FeeItemSerializer
    list_serializer_class = FeeItemListSerializer
    filterset_fields = [
        'item_category', 'grade', 'school_type',
        'is_refundable', 'fee_structure',
    ]
    search_fields = [
        'item_code', 'item_name',
        'fee_structure__structure_code', 'fee_structure__structure_name',
        'grade__grade_name', 'school_type__type_name',
    ]
    ordering_fields = [
        'item_name', 'item_code', 'amount', 'sort_order',
        'created_at',
    ]
    # Cursor pagination requires ordering fields on the model itself (not lookups).
    ordering = ['sort_order', 'item_name', 'item_code']
