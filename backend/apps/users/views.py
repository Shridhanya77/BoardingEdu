from rest_framework import viewsets, mixins
from rest_framework.permissions import DjangoModelPermissionsOrAnonReadOnly
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import User, ParentProfile, SchoolAdminProfile, StaffAdminProfile
from .serializers import (
    UserSerializer,
    ParentProfileSerializer,
    SchoolAdminProfileSerializer,
    StaffAdminProfileSerializer
)


class ReadWriteModelViewSet(viewsets.ModelViewSet):
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]


class UserViewSet(ReadWriteModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    search_fields = ['username', 'email', 'phone']
    filterset_fields = ['role', 'is_active', 'is_staff']
    ordering = ['-date_joined']


class ParentProfileViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet
):
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    queryset = ParentProfile.objects.select_related('user').all()
    serializer_class = ParentProfileSerializer
    search_fields = ['user__username', 'user__email', 'occupation']
    filterset_fields = ['preferred_contact_method']
    ordering_fields = ['created_at', 'updated_at']


class SchoolAdminProfileViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet
):
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    queryset = SchoolAdminProfile.objects.select_related('user', 'school').all()
    serializer_class = SchoolAdminProfileSerializer
    search_fields = ['user__username', 'user__email', 'school__school_code', 'school__school_name', 'designation']
    filterset_fields = ['school']
    ordering_fields = ['created_at', 'updated_at']


class StaffAdminProfileViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet
):
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    queryset = StaffAdminProfile.objects.select_related('user').all()
    serializer_class = StaffAdminProfileSerializer
    search_fields = ['user__username', 'user__email', 'designation', 'department']
    filterset_fields = ['department']
    ordering_fields = ['created_at', 'updated_at']
