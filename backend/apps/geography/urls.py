from rest_framework.routers import DefaultRouter

from .views import (
    CountryViewSet,
    StateViewSet,
    CityViewSet,
    LocationViewSet,
)

app_name = 'geography'

router = DefaultRouter()
router.register(r'countries', CountryViewSet, basename='country')
router.register(r'states', StateViewSet, basename='state')
router.register(r'cities', CityViewSet, basename='city')
router.register(r'locations', LocationViewSet, basename='location')

urlpatterns = router.urls
