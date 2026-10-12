"""
URL configuration for BoardingEdu backend project.

Root routes:
  /                                -> Redirects to /api/ (API root)
  /api/                            -> Aggregated DRF browsable API root (all endpoints)
  /admin/                          -> Django Admin
  /api-auth/                       -> DRF Browsable API login/logout
  /api/auth/jwt/token/             -> JWT obtain (SimpleJWT w/ rotation)
  /api/auth/jwt/token/refresh/     -> JWT refresh
  /api/auth/jwt/token/verify/      -> JWT verify
  /api/auth/jwt/blacklist/         -> JWT refresh token blacklist
  /api/geography/                  -> Country / State / City / Location CRUD
  /api/schools/                    -> Board / SchoolType / Grade / Facility / School / SchoolFacility
  /api/fees/                       -> AcademicYear / FeeTerm / FeeStructure / FeeItem
  /api/users/                      -> User / ParentProfile / SchoolAdminProfile / StaffAdminProfile
  /api/admissions/                 -> Child / AdmissionEnquiry
"""

from django.contrib import admin
from django.urls import include, path, reverse
from django.http import HttpResponseRedirect
from rest_framework.response import Response
from rest_framework.reverse import reverse as drf_reverse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
    TokenBlacklistView,
)
from apps.users.serializers import EmailOrUsernameTokenObtainPairSerializer


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


def root_redirect_view(request):
    return HttpResponseRedirect(drf_reverse("api-root", request=request))


class BoardingEduApiRoot(APIView):
    """
    Aggregated browsable API root listing every mounted endpoint group.
    Returns a JSON object mapping group labels to their list URLs.
    Works both for DRF browsable API (HTML) and raw Accept: application/json.
    """

    permission_classes = [AllowAny]
    throttle_scope = None

    def get(self, request, format=None):
        return Response(
            {
                "_meta": {
                    "project": "BoardingEdu School Management Platform",
                    "version": "v1",
                    "authentication": "JWT via SimpleJWT (token rotation + blacklist)",
                    "pagination": "CursorPagination (page_size=20)",
                },
                "auth": {
                    "token_obtain_pair": drf_reverse("token_obtain_pair", request=request, format=format),
                    "token_refresh": drf_reverse("token_refresh", request=request, format=format),
                    "token_verify": drf_reverse("token_verify", request=request, format=format),
                    "token_blacklist": drf_reverse("token_blacklist", request=request, format=format),
                    "browsable_api_login": drf_reverse("rest_framework:login", request=request, format=format),
                },
                "apps": {
                    "geography": drf_reverse("geography:country-list", request=request, format=format).rsplit("/countries/", 1)[0] + "/",
                    "schools":   drf_reverse("schools:board-list",   request=request, format=format).rsplit("/boards/",   1)[0] + "/",
                    "fees":      drf_reverse("fees:academicyear-list", request=request, format=format).rsplit("/academic-years/", 1)[0] + "/",
                    "users":     drf_reverse("users:user-list",      request=request, format=format).rsplit("/users/",      1)[0] + "/",
                    "admissions": drf_reverse("admissions:child-list", request=request, format=format).rsplit("/children/", 1)[0] + "/",
                },
                "admin": drf_reverse("admin:index", request=request, format=format),
            }
        )


urlpatterns = [
    # Root -> redirect to browsable API root
    path("", root_redirect_view, name="root-redirect"),
    # Aggregated API root
    path("api/", BoardingEduApiRoot.as_view(), name="api-root"),
    # Django Admin
    path("admin/", admin.site.urls),
    # DRF Browsable API auth (login/logout buttons in web UI)
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    # ===== JWT AUTH (SimpleJWT with token rotation + blacklist enabled) =====
    path(
        "api/auth/jwt/token/",
        EmailOrUsernameTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "api/auth/jwt/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "api/auth/jwt/token/verify/",
        TokenVerifyView.as_view(),
        name="token_verify",
    ),
    path(
        "api/auth/jwt/blacklist/",
        TokenBlacklistView.as_view(),
        name="token_blacklist",
    ),
    # ===== Geography App =====
    path("api/geography/", include("apps.geography.urls", namespace="geography")),
    # ===== Schools App =====
    path("api/schools/", include("apps.schools.urls", namespace="schools")),
    # ===== Fees App =====
    path("api/fees/", include("apps.fees.urls", namespace="fees")),
    # ===== Users App =====
    path("api/users/", include("apps.users.urls", namespace="users")),
    # ===== Admissions App =====
    path("api/admissions/", include("apps.admissions.urls", namespace="admissions")),
]
