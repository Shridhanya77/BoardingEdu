from rest_framework import serializers

from .models import Review


class ReviewListSerializer(serializers.ModelSerializer):
    """Lean payload for listing reviews."""

    school_id = serializers.UUIDField(source="school.school_id", read_only=True)
    school_name = serializers.CharField(source="school.school_name", read_only=True)
    school_slug = serializers.SlugField(source="school.slug", read_only=True)
    author_name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = Review
        fields = [
            "review_id",
            "school_id",
            "school_name",
            "school_slug",
            "user",
            "author_name",
            "rating",
            "title",
            "body",
            "status",
            "is_verified",
            "created_at",
        ]
        read_only_fields = [
            "review_id",
            "user",
            "status",
            "is_verified",
            "created_at",
        ]


class ReviewDetailSerializer(ReviewListSerializer):
    class Meta(ReviewListSerializer.Meta):
        fields = ReviewListSerializer.Meta.fields + ["updated_at"]
        read_only_fields = ReviewListSerializer.Meta.read_only_fields + ["updated_at"]


class ReviewCreateSerializer(serializers.ModelSerializer):
    """Write serializer — the reviewer identity is injected from the request."""

    class Meta:
        model = Review
        fields = [
            "review_id",
            "school",
            "author_name",
            "rating",
            "title",
            "body",
        ]
        read_only_fields = ["review_id"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        school = attrs.get("school")
        if user and user.is_authenticated and school:
            if Review.objects.filter(school=school, user=user).exists():
                raise serializers.ValidationError(
                    {"school": "You have already reviewed this school."}
                )
        return attrs


class SchoolRatingSummarySerializer(serializers.Serializer):
    """Read-only aggregate rating for a school."""

    school_id = serializers.UUIDField()
    school_name = serializers.CharField()
    average_rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField()
    distribution = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Mapping of star value (1-5) to review count.",
    )
