"""Public search autocomplete.

Powers the live suggestion dropdown used by the homepage hero and the school
listing page. Returns two clearly separated buckets:

  * ``schools``    – real school records matched on name / short name / slug
  * ``locations``  – States, Cities and Localities matched on name, each with
                     a verified count of active schools

Everything is filtered server-side and capped, so the browser never receives
the whole directory.
"""

from django.db.models import Case, Count, IntegerField, Q, Value, When
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.geography.models import City, Location, State
from apps.schools.models import School

from .serializers import LocationSuggestionSerializer, SchoolSuggestionSerializer

MIN_QUERY_LENGTH = 2
DEFAULT_LIMIT = 8
MAX_LIMIT = 20


def _clamp_limit(raw) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_LIMIT
    return max(1, min(value, MAX_LIMIT))


def _starts_with_rank(field: str, query: str):
    return Case(
        When(**{f"{field}__istartswith": query}, then=Value(0)),
        default=Value(1),
        output_field=IntegerField(),
    )


class SuggestionView(APIView):
    """``GET /api/search/suggestions/?q=<query>&limit=<n>``"""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, format=None):
        query = (request.query_params.get("q") or "").strip()
        limit = _clamp_limit(request.query_params.get("limit"))

        if len(query) < MIN_QUERY_LENGTH:
            return Response({"query": query, "schools": [], "locations": []})

        return Response({
            "query": query,
            "schools": self._schools(query, limit),
            "locations": self._locations(query, limit),
        })

    def _schools(self, query: str, limit: int):
        rank = Case(
            When(school_name__istartswith=query, then=Value(0)),
            When(short_name__istartswith=query, then=Value(1)),
            default=Value(2),
            output_field=IntegerField(),
        )
        queryset = (
            School.objects.filter(status=True)
            .filter(
                Q(school_name__icontains=query)
                | Q(short_name__icontains=query)
                | Q(slug__icontains=query)
            )
            .select_related("country", "state", "city", "location")
            .prefetch_related("boards", "school_types")
            .annotate(_match_rank=rank)
            .order_by("_match_rank", "-is_featured", "school_name")[:limit]
        )
        return SchoolSuggestionSerializer(
            queryset, many=True, context={"request": self.request}
        ).data

    def _locations(self, query: str, limit: int):
        active = Q(schools__status=True)
        rows: list[dict] = []

        states = (
            State.objects.filter(status=True, state_name__icontains=query)
            .select_related("country")
            .annotate(
                schools_count=Count("schools", filter=active, distinct=True),
                _rank=_starts_with_rank("state_name", query),
            )
            .filter(schools_count__gt=0)
            .order_by("_rank", "-schools_count", "state_name")[:limit]
        )
        for state in states:
            rows.append({
                "kind": "state",
                "name": state.state_name,
                "slug": state.slug,
                "country_slug": state.country.slug,
                "state_slug": state.slug,
                "city_slug": None,
                "location_slug": None,
                "schools_count": state.schools_count,
                "_rank": state._rank,
            })

        cities = (
            City.objects.filter(status=True, city_name__icontains=query)
            .select_related("state", "state__country")
            .annotate(
                schools_count=Count("schools", filter=active, distinct=True),
                _rank=_starts_with_rank("city_name", query),
            )
            .filter(schools_count__gt=0)
            .order_by("_rank", "-schools_count", "city_name")[:limit]
        )
        for city in cities:
            rows.append({
                "kind": "city",
                "name": city.city_name,
                "slug": city.slug,
                "country_slug": city.state.country.slug,
                "state_slug": city.state.slug,
                "city_slug": city.slug,
                "location_slug": None,
                "schools_count": city.schools_count,
                "_rank": city._rank,
            })

        localities = (
            Location.objects.filter(status=True, location_name__icontains=query)
            .select_related("city", "city__state", "city__state__country")
            .annotate(
                schools_count=Count("schools", filter=active, distinct=True),
                _rank=_starts_with_rank("location_name", query),
            )
            .filter(schools_count__gt=0)
            .order_by("_rank", "-schools_count", "location_name")[:limit]
        )
        for locality in localities:
            rows.append({
                "kind": "locality",
                "name": locality.location_name,
                "slug": locality.slug,
                "country_slug": locality.city.state.country.slug,
                "state_slug": locality.city.state.slug,
                "city_slug": locality.city.slug,
                "location_slug": locality.slug,
                "schools_count": locality.schools_count,
                "_rank": locality._rank,
            })

        rows.sort(key=lambda row: (row["_rank"], -row["schools_count"], row["name"]))
        trimmed = [
            {key: value for key, value in row.items() if key != "_rank"}
            for row in rows[:limit]
        ]
        return LocationSuggestionSerializer(trimmed, many=True).data
