from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny

from .models import GuideArticle, GuideCategory
from .serializers import GuideArticleSerializer, GuideCategorySerializer


class PublicGuideArticleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GuideArticleSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "summary", "category__name"]
    ordering_fields = ["title", "updated_on", "sort_order"]
    ordering = ["sort_order", "title"]

    def get_queryset(self):
        return GuideArticle.objects.filter(
            status=True,
            category__status=True,
        ).select_related("category")


class PublicGuideCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GuideCategorySerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return GuideCategory.objects.filter(
            status=True,
            articles__status=True,
        ).distinct()
