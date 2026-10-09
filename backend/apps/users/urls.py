from django.urls import path, include
from rest_framework.routers import DefaultRouter

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
    path('', include(router.urls)),
]
