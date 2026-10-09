from rest_framework import viewsets
from rest_framework.permissions import DjangoModelPermissionsOrAnonReadOnly
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Child, AdmissionEnquiry
from .serializers import ChildSerializer, AdmissionEnquirySerializer


class ChildViewSet(viewsets.ModelViewSet):
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    queryset = Child.objects.select_related(
        'parent_profile',
        'current_grade',
        'parent_profile__user'
    ).all()
    serializer_class = ChildSerializer
    search_fields = ['name']
    filterset_fields = ['parent_profile', 'gender', 'current_grade']
    ordering_fields = ['name', 'date_of_birth', 'created_at']


class AdmissionEnquiryViewSet(viewsets.ModelViewSet):
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    queryset = AdmissionEnquiry.objects.select_related(
        'parent_profile',
        'parent_profile__user',
        'child',
        'child__current_grade',
        'school',
        'academic_year',
        'applying_for_grade',
        'assigned_to'
    ).all()
    serializer_class = AdmissionEnquirySerializer
    search_fields = [
        'enquiry_code',
        'message',
        'parent_profile__user__username',
        'child__name'
    ]
    filterset_fields = [
        'school',
        'status',
        'priority',
        'source',
        'academic_year',
        'assigned_to',
        'parent_profile',
        'child',
        'applying_for_grade'
    ]
    ordering = ['-created_at']
    ordering_fields = [
        'created_at',
        'updated_at',
        'next_followup_at',
        'closed_at',
        'priority'
    ]
