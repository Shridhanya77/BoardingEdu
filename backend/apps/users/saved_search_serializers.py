"""Serializers for a parent's saved school searches."""
from rest_framework import serializers

from apps.schools.models import Board, Facility, SchoolType

from .models import SavedSearch

HOME_CATEGORIES = {"day-school", "residential-school", "boarding-schools"}
GENDERS = {"COED", "BOYS", "GIRLS"}


def _geo_label(obj):
    if obj is None:
        return None
    return {
        "id": str(obj.pk),
        "name": getattr(obj, "location_name", None)
        or getattr(obj, "city_name", None)
        or getattr(obj, "state_name", None)
        or getattr(obj, "country_name", ""),
        "slug": obj.slug,
    }


class SavedSearchSerializer(serializers.ModelSerializer):
    school_types = serializers.PrimaryKeyRelatedField(
        many=True, queryset=SchoolType.objects.filter(status=True), required=False,
    )
    boards = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Board.objects.filter(status=True), required=False,
    )
    facilities = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Facility.objects.filter(status=True), required=False,
    )
    country_detail = serializers.SerializerMethodField()
    state_detail = serializers.SerializerMethodField()
    city_detail = serializers.SerializerMethodField()
    location_detail = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()
    match_count = serializers.SerializerMethodField()

    class Meta:
        model = SavedSearch
        fields = [
            "saved_search_id",
            "name",
            "country", "state", "city", "location",
            "country_detail", "state_detail", "city_detail", "location_detail",
            "home_category",
            "school_types", "boards", "facilities",
            "gender", "min_fee", "max_fee",
            "keywords",
            "alert_frequency", "is_active",
            "last_notified_at", "created_at", "updated_at",
            "label", "match_count",
        ]
        read_only_fields = [
            "saved_search_id", "last_notified_at", "created_at", "updated_at",
            "label", "match_count",
        ]

    def get_country_detail(self, obj):
        return _geo_label(obj.country)

    def get_state_detail(self, obj):
        return _geo_label(obj.state)

    def get_city_detail(self, obj):
        return _geo_label(obj.city)

    def get_location_detail(self, obj):
        return _geo_label(obj.location)

    def get_match_count(self, obj):
        return obj.matches.count()

    def get_label(self, obj):
        return build_saved_search_label(obj)

    def validate(self, attrs):
        min_fee = attrs.get("min_fee", getattr(self.instance, "min_fee", None))
        max_fee = attrs.get("max_fee", getattr(self.instance, "max_fee", None))
        if min_fee is not None and max_fee is not None and min_fee > max_fee:
            raise serializers.ValidationError(
                {"max_fee": "Maximum fee must be greater than or equal to the minimum fee."}
            )

        home_category = attrs.get("home_category", getattr(self.instance, "home_category", ""))
        if home_category and home_category not in HOME_CATEGORIES:
            raise serializers.ValidationError({"home_category": "Unknown school category."})

        gender = attrs.get("gender", getattr(self.instance, "gender", ""))
        if gender and gender not in GENDERS:
            raise serializers.ValidationError({"gender": "Unknown gender filter."})

        country = attrs.get("country", getattr(self.instance, "country", None))
        state = attrs.get("state", getattr(self.instance, "state", None))
        city = attrs.get("city", getattr(self.instance, "city", None))
        location = attrs.get("location", getattr(self.instance, "location", None))
        if country and state and state.country_id != country.pk:
            raise serializers.ValidationError({"state": "The state does not belong to the selected country."})
        if state and city and city.state_id != state.pk:
            raise serializers.ValidationError({"city": "The city does not belong to the selected state."})
        if city and location and location.city_id != city.pk:
            raise serializers.ValidationError({"location": "The location does not belong to the selected city."})
        return attrs


def build_saved_search_label(saved_search):
    """Human-readable one-line summary of the saved filters."""
    parts = []
    for value in (
        saved_search.location,
        saved_search.city,
        saved_search.state,
        saved_search.country,
    ):
        if value is not None:
            parts.append(
                getattr(value, "location_name", None)
                or getattr(value, "city_name", None)
                or getattr(value, "state_name", None)
                or getattr(value, "country_name", "")
            )
            break
    if saved_search.home_category:
        parts.append(
            "Day schools"
            if saved_search.home_category == "day-school"
            else "Boarding schools"
        )
    board_names = [board.board_name for board in saved_search.boards.all()]
    if board_names:
        parts.append(", ".join(board_names))
    if saved_search.min_fee is not None or saved_search.max_fee is not None:
        low = f"₹{int(saved_search.min_fee):,}" if saved_search.min_fee is not None else "any"
        high = f"₹{int(saved_search.max_fee):,}" if saved_search.max_fee is not None else "any"
        parts.append(f"Fees {low} – {high}")
    if saved_search.keywords:
        parts.append(f"“{saved_search.keywords}”")
    return " · ".join(parts) or "All schools"
