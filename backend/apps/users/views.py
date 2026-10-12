from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import (
    DjangoModelPermissionsOrAnonReadOnly,
    IsAuthenticated,
    AllowAny,
)
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    User,
    ParentProfile,
    SchoolAdminProfile,
    StaffAdminProfile,
)

from .serializers import (
    UserListSerializer,
    UserDetailSerializer,
    UserRegisterSerializer,
    ParentProfileListSerializer,
    ParentProfileDetailSerializer,
    SchoolAdminProfileListSerializer,
    SchoolAdminProfileDetailSerializer,
    StaffAdminProfileListSerializer,
    StaffAdminProfileDetailSerializer,
)


# ============================================================
# BASE READ/WRITE VIEWSET
# ============================================================

class ReadWriteModelViewSet(viewsets.ModelViewSet):
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]

    def get_serializer_class(self):
        """Use lean List serializer for list actions; otherwise use the default detail serializer."""
        if self.action in ('list',) and hasattr(self, 'list_serializer_class'):
            return self.list_serializer_class
        return self.serializer_class


# ============================================================
# USER VIEWSET
# Endpoints include list, retrieve, create, update, delete,
# register, and me.
# ============================================================

class UserViewSet(ReadWriteModelViewSet):
    queryset = User.objects.all()

    serializer_class = UserDetailSerializer
    list_serializer_class = UserListSerializer

    search_fields = [
        "username",
        "email",
        "phone",
        "first_name",
        "last_name",
    ]

    filterset_fields = [
        "role",
        "is_active",
        "is_staff",
    ]

    ordering_fields = [
        "username",
        "date_joined",
        "created_at",
    ]

    ordering = ["-date_joined"]

    def get_permissions(self):
        """Allow public registration; protect other endpoints.

        Authenticated-list behaviour:
          • register    → anyone (public signup)
          • me          → logged-in user only (their own record)
          • retrieve    → default DjangoModelPermissions (super/staff)
          • list        → authenticated users only (no public directory)
          • write ops   → staff+ only via DjangoModelPermissions
        """
        if self.action == 'register':
            return [AllowAny()]
        if self.action == 'me':
            return [IsAuthenticated()]
        if self.action == 'list':
            # Only authenticated users can browse the user directory.
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_serializer_class(self):
        """Choose a serializer based on the requested action."""
        if self.action == "register":
            return UserRegisterSerializer

        if self.action == "list":
            return self.list_serializer_class

        return self.serializer_class

    # --------------------------------------------------------
    # POST /api/users/users/register/
    # --------------------------------------------------------

    @action(
        detail=False,
        methods=["post"],
        name="Register new Parent user",
    )
    def register(self, request, *args, **kwargs):
        """
        Register a new user.
        UserRegisterSerializer should handle creating the
        user and its ParentProfile where appropriate.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        output = UserDetailSerializer(
            user,
            context=self.get_serializer_context(),
        )

        headers = self.get_success_headers(output.data)

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    # --------------------------------------------------------
    # GET /api/users/users/me/
    # --------------------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        name="Current authenticated user",
    )
    def me(self, request, *args, **kwargs):
        """Return the currently authenticated user's details."""
        serializer = UserDetailSerializer(
            request.user,
            context=self.get_serializer_context(),
        )

        return Response(serializer.data)


# ============================================================
# BASE PROFILE VIEWSET
# Supports list, retrieve, and update.
# Does not provide create or delete actions.
# ============================================================

class ProfileBaseViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]

    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]

    def get_serializer_class(self):
        """Use a lightweight serializer for list responses."""
        if (
            self.action == "list"
            and hasattr(self, "list_serializer_class")
        ):
            return self.list_serializer_class

        return self.serializer_class


# ============================================================
# PARENT PROFILE VIEWSET
# ============================================================

class ParentProfileViewSet(ProfileBaseViewSet):
    queryset = ParentProfile.objects.select_related("user").all()

    serializer_class = ParentProfileDetailSerializer
    list_serializer_class = ParentProfileListSerializer

    search_fields = [
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "occupation",
    ]

    filterset_fields = [
        "preferred_contact_method",
    ]

    ordering_fields = [
        "created_at",
        "updated_at",
    ]


# ============================================================
# SCHOOL ADMIN PROFILE VIEWSET
# ============================================================

class SchoolAdminProfileViewSet(ProfileBaseViewSet):
    queryset = SchoolAdminProfile.objects.select_related(
        "user",
        "school",
    ).all()

    serializer_class = SchoolAdminProfileDetailSerializer
    list_serializer_class = SchoolAdminProfileListSerializer

    search_fields = [
        "user__username",
        "user__email",
        "school__school_code",
        "school__school_name",
        "designation",
    ]

    filterset_fields = [
        "school",
    ]

    ordering_fields = [
        "created_at",
        "updated_at",
    ]


# ============================================================
# STAFF ADMIN PROFILE VIEWSET
# ============================================================

class StaffAdminProfileViewSet(ProfileBaseViewSet):
    queryset = StaffAdminProfile.objects.select_related("user").all()

    serializer_class = StaffAdminProfileDetailSerializer
    list_serializer_class = StaffAdminProfileListSerializer

    search_fields = [
        "user__username",
        "user__email",
        "designation",
        "department",
    ]

    filterset_fields = [
        "department",
    ]

    ordering_fields = [
        "created_at",
        "updated_at",
    ]
