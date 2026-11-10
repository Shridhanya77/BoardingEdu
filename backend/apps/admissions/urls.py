from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .parent_api import (
    ApplicationDocumentFileView,
    ApplicationDocumentReviewView,
    ApplicationDocumentUploadView,
    ApplicationMessageListView,
    ParentApplicationDetailView,
    ParentApplicationListView,
    ParentNotificationListView,
    ParentNotificationReadView,
    ParentProfilePhotoView,
    ParentProfileView,
    ParentWithdrawApplicationView,
)
from .views import ChildViewSet, AdmissionEnquiryViewSet, CounsellingRequestCreateView

app_name = 'admissions'

router = DefaultRouter()
router.register(r'children', ChildViewSet, basename='child')
router.register(r'enquiries', AdmissionEnquiryViewSet, basename='admissionenquiry')

urlpatterns = [
    path('counselling-requests/', CounsellingRequestCreateView.as_view(), name='counselling-request-create'),
    path('applications/', ParentApplicationListView.as_view(), name='parent-applications'),
    path('applications/<uuid:enquiry_id>/', ParentApplicationDetailView.as_view(), name='parent-application'),
    path('applications/<uuid:enquiry_id>/withdraw/', ParentWithdrawApplicationView.as_view(), name='parent-application-withdraw'),
    path('applications/<uuid:enquiry_id>/documents/', ApplicationDocumentUploadView.as_view(), name='application-documents'),
    path('applications/<uuid:enquiry_id>/documents/<uuid:document_id>/file/', ApplicationDocumentFileView.as_view(), name='application-document-file'),
    path('applications/<uuid:enquiry_id>/documents/<uuid:document_id>/review/', ApplicationDocumentReviewView.as_view(), name='application-document-review'),
    path('applications/<uuid:enquiry_id>/messages/', ApplicationMessageListView.as_view(), name='application-messages'),
    path('notifications/', ParentNotificationListView.as_view(), name='parent-notifications'),
    path('notifications/read/', ParentNotificationReadView.as_view(), name='parent-notifications-read'),
    path('notifications/<uuid:notification_id>/read/', ParentNotificationReadView.as_view(), name='parent-notification-read'),
    path('profile/', ParentProfileView.as_view(), name='parent-profile'),
    path('profile/photo/', ParentProfilePhotoView.as_view(), name='parent-profile-photo'),
    path('', include(router.urls)),
]
