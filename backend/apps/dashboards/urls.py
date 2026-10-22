from django.urls import path

from .views import (
    AdminDashboardView,
    ParentDashboardView,
    SchoolDashboardView,
    StaffAdminDashboardView,
)

app_name = "dashboards"

urlpatterns = [
    path("school/", SchoolDashboardView.as_view(), name="school"),
    path("parent/", ParentDashboardView.as_view(), name="parent"),
    path("admin/", AdminDashboardView.as_view(), name="admin"),
    path("staff-admin/", StaffAdminDashboardView.as_view(), name="staff-admin"),
]
