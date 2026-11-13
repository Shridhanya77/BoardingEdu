from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PublicGuideArticleViewSet, PublicGuideCategoryViewSet

app_name = "guides"

router = DefaultRouter()
router.register("articles", PublicGuideArticleViewSet, basename="article")
router.register("categories", PublicGuideCategoryViewSet, basename="category")

urlpatterns = [path("", include(router.urls))]
