from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .password_api import PasswordChangeView, PasswordResetConfirmView, PasswordResetRequestView
from .views import (
    UserViewSet,
    ParentProfileViewSet,
    SchoolAdminProfileViewSet,
    StaffAdminProfileViewSet
)

app_name = 'users'

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'parent-profiles', ParentProfileViewSet, basename='parentprofile')
router.register(r'school-admin-profiles', SchoolAdminProfileViewSet, basename='schooladminprofile')
router.register(r'staff-admin-profiles', StaffAdminProfileViewSet, basename='staffadminprofile')

urlpatterns = [
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('password-change/', PasswordChangeView.as_view(), name='password-change'),
    path('', include(router.urls)),
]
