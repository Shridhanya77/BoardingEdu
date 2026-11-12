from django.urls import path

from .school_ops import (
    SchoolFacilityWriteView,
    SchoolAdmissionResourceWriteView,
    SchoolFeeItemWriteView,
    SchoolFeePublishView,
    SchoolGradeWriteView,
    SchoolPhotoWriteView,
)
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
    path("school/facilities/", SchoolFacilityWriteView.as_view(), name="school-facilities"),
    path(
        "school/facilities/<uuid:school_facility_id>/",
        SchoolFacilityWriteView.as_view(),
        name="school-facility",
    ),
    path("school/grades/", SchoolGradeWriteView.as_view(), name="school-grades"),
    path(
        "school/grades/<uuid:school_grade_id>/",
        SchoolGradeWriteView.as_view(),
        name="school-grade",
    ),
    path("school/photos/", SchoolPhotoWriteView.as_view(), name="school-photos"),
    path("school/photos/<uuid:photo_id>/", SchoolPhotoWriteView.as_view(), name="school-photo"),
    path(
        "school/admission-resources/",
        SchoolAdmissionResourceWriteView.as_view(),
        name="school-admission-resources",
    ),
    path(
        "school/admission-resources/<uuid:resource_id>/",
        SchoolAdmissionResourceWriteView.as_view(),
        name="school-admission-resource",
    ),
    path("school/fees/items/", SchoolFeeItemWriteView.as_view(), name="school-fee-items"),
    path(
        "school/fees/items/<uuid:fee_item_id>/",
        SchoolFeeItemWriteView.as_view(),
        name="school-fee-item",
    ),
    path(
        "school/fees/<uuid:fee_structure_id>/publish/",
        SchoolFeePublishView.as_view(),
        name="school-fee-publish",
    ),
    path("parent/", ParentDashboardView.as_view(), name="parent"),
    path("parent/shortlist/", ParentShortlistView.as_view(), name="parent-shortlist"),
    path("admin/", AdminDashboardView.as_view(), name="admin"),
    path("staff-admin/", StaffAdminDashboardView.as_view(), name="staff-admin"),
]
