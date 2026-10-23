from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404

from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import (
    AllowAny,
    BasePermission,
    IsAuthenticated,
    SAFE_METHODS,
)
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend

from apps.schools.models import School
from apps.users.models import User

from .models import Review
from .serializers import (
    ReviewCreateSerializer,
    ReviewDetailSerializer,
    ReviewListSerializer,
    PublicRatingSummarySerializer,
    SchoolRatingSummarySerializer,
)


class IsReviewOwnerOrHigher(BasePermission):
    """Only the review author (or an admin role) may edit/delete a review."""

    message = "You can only modify your own review."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        if getattr(user, "role", None) in (
            User.ROLE_SUPER_ADMIN,
            User.ROLE_STAFF_ADMIN,
        ):
            return True
        return obj.user_id == user.pk


class ReviewViewSet(viewsets.ModelViewSet):
    """
    School reviews & ratings.

    - Public read access to published reviews.
    - Authenticated parents (and all roles) can submit one review per school.
    - Owners / admins can edit or remove a review.
    """

    serializer_class = ReviewDetailSerializer
    list_serializer_class = ReviewListSerializer
    lookup_field = "review_id"
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["school", "rating", "status", "is_verified"]
    search_fields = ["title", "body", "author_name", "school__school_name"]
    ordering_fields = ["created_at", "rating"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Review.objects.select_related("school", "user")
        user = getattr(self.request, "user", None)

        if user is None or not user.is_authenticated:
            return qs.published()

        role = getattr(user, "role", None)
        if role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN):
            return qs

        if role == User.ROLE_SCHOOL_ADMIN:
            school_id = getattr(
                getattr(user, "school_admin_profile", None),
                "school_id",
                None,
            )
            if school_id is None:
                return qs.published()
            return qs.filter(Q(status=Review.STATUS_PUBLISHED) | Q(school_id=school_id))

        if role == User.ROLE_PARENT:
            return qs.filter(
                Q(status=Review.STATUS_PUBLISHED) | Q(user_id=user.pk)
            )

        return qs.published()

    def get_serializer_class(self):
        if self.action == "list":
            return self.list_serializer_class
        if self.action == "create":
            return ReviewCreateSerializer
        return self.serializer_class

    def get_permissions(self):
        if self.action in ("list", "retrieve", "summary", "public_summary"):
            return [AllowAny()]
        if self.action == "create":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsReviewOwnerOrHigher()]

    def get_throttles(self):
        # ScopedRateThrottle only applies a limit when a scope is set.
        self.throttle_scope = "review" if self.action == "create" else ""
        return super().get_throttles()

    def perform_create(self, serializer):
        user = self.request.user
        author_name = serializer.validated_data.get("author_name") or ""
        if not author_name:
            author_name = user.get_full_name() or user.username
        serializer.save(user=user, author_name=author_name)

    @action(
        detail=False,
        methods=["get"],
        url_path="summary",
        name="School rating summary",
    )
    def summary(self, request):
        """
        Aggregate rating for a school.

        GET /api/reviews/summary/?school=<school_id>
        """
        school_id = request.query_params.get("school")
        if not school_id:
            return Response(
                {"detail": "Query parameter 'school' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school = get_object_or_404(School, pk=school_id)
        published = Review.objects.filter(
            school=school,
            status=Review.STATUS_PUBLISHED,
        )
        aggregate = published.aggregate(review_count=Count("review_id"))
        # average is computed in Python to avoid None handling differences
        ratings = list(published.values_list("rating", flat=True))
        average = round(sum(ratings) / len(ratings), 2) if ratings else None

        distribution = {str(star): 0 for star in range(1, 6)}
        for star in ratings:
            distribution[str(star)] += 1

        category_fields = (
            "academics_rating",
            "facilities_rating",
            "safety_rating",
            "communication_rating",
        )
        category_aggregate = published.aggregate(
            **{
                key: expression
                for field in category_fields
                for key, expression in (
                    (f"{field}_average", Avg(field)),
                    (f"{field}_count", Count(field)),
                )
            }
        )
        payload = {
            "school_id": school.school_id,
            "school_name": school.school_name,
            "average_rating": average,
            "review_count": aggregate["review_count"],
            "distribution": distribution,
            "category_ratings": {
                field: {
                    "average": (
                        round(category_aggregate[f"{field}_average"], 2)
                        if category_aggregate[f"{field}_average"] is not None
                        else None
                    ),
                    "count": category_aggregate[f"{field}_count"],
                }
                for field in category_fields
            },
        }
        return Response(SchoolRatingSummarySerializer(payload).data)

    @action(
        detail=False,
        methods=["get"],
        url_path="public-summary",
        name="Public school review summary",
    )
    def public_summary(self, request):
        """Aggregate rating across all published reviews."""
        published = Review.objects.published()
        aggregate = published.aggregate(
            average_rating=Avg("rating"),
            review_count=Count("review_id"),
        )
        distribution = {str(star): 0 for star in range(1, 6)}
        for row in published.values("rating").annotate(count=Count("review_id")):
            distribution[str(row["rating"])] = row["count"]
        payload = {
            "average_rating": (
                round(aggregate["average_rating"], 2)
                if aggregate["average_rating"] is not None
                else None
            ),
            "review_count": aggregate["review_count"],
            "distribution": distribution,
        }
        return Response(PublicRatingSummarySerializer(payload).data)
