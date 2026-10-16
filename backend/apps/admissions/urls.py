from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ChildViewSet, AdmissionEnquiryViewSet, CounsellingRequestCreateView

app_name = 'admissions'

router = DefaultRouter()
router.register(r'children', ChildViewSet, basename='child')
router.register(r'enquiries', AdmissionEnquiryViewSet, basename='admissionenquiry')

urlpatterns = [
    path('counselling-requests/', CounsellingRequestCreateView.as_view(), name='counselling-request-create'),
    path('', include(router.urls)),
]
