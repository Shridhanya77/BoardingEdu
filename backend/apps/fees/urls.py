from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AcademicYearViewSet,
    FeeTermViewSet,
    FeeStructureViewSet,
    FeeItemViewSet,
    PublicFeeEstimateView,
)

app_name = 'fees'

router = DefaultRouter()
router.register(r'academic-years',  AcademicYearViewSet,  basename='academicyear')
router.register(r'fee-terms',      FeeTermViewSet,      basename='feeterm')
router.register(r'fee-structures', FeeStructureViewSet, basename='feestructure')
router.register(r'fee-items',       FeeItemViewSet,       basename='feeitem')

urlpatterns = [
    path("estimate/", PublicFeeEstimateView.as_view(), name="public-fee-estimate"),
    path('', include(router.urls)),
]
