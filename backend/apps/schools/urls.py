from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BoardViewSet,
    SchoolTypeViewSet,
    GradeViewSet,
    FacilityViewSet,
    SchoolViewSet,
    SchoolFacilityViewSet,
    SchoolGradeViewSet,
    SchoolFAQViewSet,
)

app_name = 'schools'

router = DefaultRouter()
router.register(r'boards',             BoardViewSet,          basename='board')
router.register(r'school-types',     SchoolTypeViewSet,    basename='schooltype')
router.register(r'grades',         GradeViewSet,        basename='grade')
router.register(r'facilities',       FacilityViewSet,     basename='facility')
router.register(r'schools',          SchoolViewSet,        basename='school')
router.register(r'school-facilities', SchoolFacilityViewSet, basename='schoolfacility')
router.register(r'school-grades',   SchoolGradeViewSet,   basename='schoolgrade')
router.register(r'faqs', SchoolFAQViewSet, basename='schoolfaq')

urlpatterns = [
    path('', include(router.urls)),
]
