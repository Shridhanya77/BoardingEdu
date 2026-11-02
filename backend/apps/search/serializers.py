"""Serializers for the public search autocomplete endpoint.

These are intentionally lightweight: the dropdown only needs a handful of
fields per result, so we avoid the heavier SchoolListSerializer (photos,
grade ranges, ratings) and keep the query cheap.
"""

from rest_framework import serializers

from apps.schools.models import School
from config.school_media import cover_image_url_for_school, rewrite_school_media_url


class SchoolSuggestionSerializer(serializers.ModelSerializer):
    school_image_url = serializers.SerializerMethodField()
    school_logo_url = serializers.SerializerMethodField()
    country_slug = serializers.SlugField(source="country.slug", read_only=True)
    state_slug = serializers.SlugField(source="state.slug", read_only=True)
    state_name = serializers.CharField(source="state.state_name", read_only=True)
    city_slug = serializers.SlugField(source="city.slug", read_only=True)
    city_name = serializers.CharField(source="city.city_name", read_only=True)
    location_slug = serializers.SlugField(
        source="location.slug", read_only=True, allow_null=True
    )
    school_type_name = serializers.SerializerMethodField()
    board_name = serializers.SerializerMethodField()
    verification_status = serializers.CharField(
        source="get_verification_status_display", read_only=True
    )

    class Meta:
        model = School
        fields = [
            "school_id",
            "school_name",
            "short_name",
            "slug",
            "school_image_url",
            "school_logo_url",
            "country_slug",
            "state_slug",
            "state_name",
            "city_slug",
            "city_name",
            "location_slug",
            "school_type_name",
            "board_name",
            "verification_status",
            "is_featured",
        ]

    def get_school_image_url(self, obj):
        return rewrite_school_media_url(
            cover_image_url_for_school(obj), self.context.get("request")
        )

    def get_school_logo_url(self, obj):
        return rewrite_school_media_url(obj.school_logo_url, self.context.get("request"))

    def _first_related(self, obj, attr):
        # Prefetched by the view; falls back to a bounded query if not.
        rows = list(getattr(obj, attr).all())
        return rows[0] if rows else None

    def get_school_type_name(self, obj):
        school_type = self._first_related(obj, "school_types")
        return school_type.type_name if school_type else None

    def get_board_name(self, obj):
        from apps.schools.display import board_label

        return board_label(self._first_related(obj, "boards"))


class LocationSuggestionSerializer(serializers.Serializer):
    """One autocomplete row for a State / City / Locality.

    The slug chain is returned raw so the frontend builds the canonical
    listing URL with its existing helpers (never hardcoded here).
    """

    kind = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField()
    country_slug = serializers.CharField(allow_null=True)
    state_slug = serializers.CharField(allow_null=True)
    city_slug = serializers.CharField(allow_null=True)
    location_slug = serializers.CharField(allow_null=True)
    schools_count = serializers.IntegerField()
