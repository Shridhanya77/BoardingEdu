from django.urls import path

from .views import (
    AdminDashboardView,
    ParentDashboardView,
    ParentShortlistView,
    SchoolDashboardView,
    SchoolEnquiryStatusView,
    StaffAdminDashboardView,
)

app_name = "dashboards"

urlpatterns = [
    path("school/", SchoolDashboardView.as_view(), name="school"),
    path(
        "school/enquiries/<uuid:enquiry_id>/status/",
        SchoolEnquiryStatusView.as_view(),
        name="school-enquiry-status",
    ),
    path("parent/", ParentDashboardView.as_view(), name="parent"),
    path("parent/shortlist/", ParentShortlistView.as_view(), name="parent-shortlist"),
    path("admin/", AdminDashboardView.as_view(), name="admin"),
    path("staff-admin/", StaffAdminDashboardView.as_view(), name="staff-admin"),
]
