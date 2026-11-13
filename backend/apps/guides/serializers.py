from rest_framework import serializers

from .models import GuideArticle, GuideCategory


class GuideCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GuideCategory
        fields = ["slug", "name"]


class GuideArticleSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="category.name", read_only=True)
    coverImageUrl = serializers.CharField(source="cover_image_url", read_only=True)
    updated = serializers.DateField(source="updated_on", read_only=True)
    readingMinutes = serializers.IntegerField(source="reading_minutes", read_only=True)

    class Meta:
        model = GuideArticle
        fields = [
            "slug",
            "title",
            "summary",
            "coverImageUrl",
            "updated",
            "readingMinutes",
            "category",
            "sections",
        ]
