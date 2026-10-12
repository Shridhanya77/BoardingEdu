from rest_framework import viewsets
from rest_framework.permissions import (
    IsAuthenticated,
    AllowAny,
)

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q

from apps.users.permissions import (
    IsStaffAdmin,
    IsParent,
    IsOwnChildOrHigher,
    IsOwnEnquiryOrHigher,
)
from apps.users.models import User

from .models import Child, AdmissionEnquiry
from .serializers import ChildSerializer, AdmissionEnquirySerializer


# ============================================================
# CHILD VIEWSET
# ============================================================

class ChildViewSet(viewsets.ModelViewSet):
    base_queryset = Child.objects.select_related(
        "parent_profile",
        "current_grade",
        "parent_profile__user",
    )

    queryset = base_queryset.all()
    serializer_class = ChildSerializer

    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]

    search_fields = ["name"]

    filterset_fields = [
        "parent_profile",
        "gender",
        "current_grade",
    ]

    ordering_fields = [
        "name",
        "date_of_birth",
        "created_at",
    ]

    def get_queryset(self):
        """
        DRF does NOT run object-level permissions on the `list` action.
        We MUST scope the base queryset here or a Parent user will see
        every child in the database.
        """
        user = getattr(self.request, 'user', None)
        qs = self.base_queryset

        if user is None or not user.is_authenticated:
            return qs.none()

        role = getattr(user, 'role', None)

        # Super/Staff admins see every child in the system
        if role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN):
            return qs.all()

        # School admins see children who have enquiries at their school
        if role == User.ROLE_SCHOOL_ADMIN:
            school_id = getattr(
                getattr(user, 'school_admin_profile', None),
                'school_id',
                None,
            )
            if school_id is None:
                return qs.none()
            return qs.filter(
                enquiries__school_id=school_id,
            ).distinct()

        # Parents see ONLY their own children
        if role == User.ROLE_PARENT:
            profile_id = getattr(
                getattr(user, 'parent_profile', None),
                'pk',
                None,
            )
            if profile_id is None:
                return qs.none()
            return qs.filter(parent_profile_id=profile_id)

        # Unknown role: nothing
        return qs.none()

    def get_permissions(self):
        """
        Create:
            Authenticated parents only.

        List/Retrieve:
            Authenticated users with appropriate permissions.

        Update/Delete:
            The child's parent or an authorized higher-level role.
        """
        if self.action == "create":
            return [IsAuthenticated(), IsParent()]

        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsOwnChildOrHigher()]

        # list/retrieve: get_queryset scopes the rows; allow any authenticated viewer
        # (object-level still guards retrieve for extra safety on detail URLs)
        return [IsAuthenticated(), IsOwnChildOrHigher()]


# ============================================================
# ADMISSION ENQUIRY VIEWSET
# ============================================================

class AdmissionEnquiryViewSet(viewsets.ModelViewSet):
    base_queryset = AdmissionEnquiry.objects.select_related(
        "parent_profile",
        "parent_profile__user",
        "child",
        "child__current_grade",
        "school",
        "academic_year",
        "applying_for_grade",
        "assigned_to",
    )

    queryset = base_queryset.all()
    serializer_class = AdmissionEnquirySerializer

    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]

    search_fields = [
        "enquiry_code",
        "message",
        "parent_profile__user__username",
        "child__name",
    ]

    filterset_fields = [
        "school",
        "status",
        "priority",
        "source",
        "academic_year",
        "assigned_to",
        "parent_profile",
        "child",
        "applying_for_grade",
    ]

    ordering = ["-created_at"]

    ordering_fields = [
        "created_at",
        "updated_at",
        "next_followup_at",
        "closed_at",
        "priority",
    ]

    def get_queryset(self):
        """
        SCOPE rows by the calling user's role.
        Object-level permissions do NOT run on `list` — this is the
        single source of truth for "which enquiries can this user see".
        """
        user = getattr(self.request, 'user', None)
        qs = self.base_queryset

        # Unauthenticated: can CREATE enquiries but cannot READ any list
        if user is None or not user.is_authenticated:
            return qs.none()

        role = getattr(user, 'role', None)

        # Super admins & CRM staff see the whole enquiry pipeline
        if role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN):
            return qs.all()

        # School admins see ONLY enquiries routed to their own school
        if role == User.ROLE_SCHOOL_ADMIN:
            school_id = getattr(
                getattr(user, 'school_admin_profile', None),
                'school_id',
                None,
            )
            return qs.filter(school_id=school_id) if school_id else qs.none()

        # Parents see ONLY their own enquiries
        if role == User.ROLE_PARENT:
            profile_id = getattr(
                getattr(user, 'parent_profile', None),
                'pk',
                None,
            )
            return qs.filter(parent_profile_id=profile_id) if profile_id else qs.none()

        return qs.none()

    def get_permissions(self):
        """
        Create:
            Public enquiries are allowed, including guest enquiries.

        Destroy:
            Authenticated staff admins only.

        Other actions:
            Authenticated users must pass the enquiry permission check.
        """
        if self.action == "create":
            return [AllowAny()]

        if self.action == "destroy":
            return [IsAuthenticated(), IsStaffAdmin()]

        return [IsAuthenticated(), IsOwnEnquiryOrHigher()]

    def perform_create(self, serializer):
        """
        Associate an authenticated parent with their enquiry.
        Guest enquiries remain possible if the serializer and model
        permit a nullable parent_profile.
        """
        user = self.request.user

        if (
            user
            and user.is_authenticated
            and getattr(user, "role", None) == "PARENT"
        ):
            try:
                parent_profile = user.parent_profile
            except Exception:
                parent_profile = None

            if parent_profile is not None:
                serializer.save(parent_profile=parent_profile)
                return

        serializer.save()

