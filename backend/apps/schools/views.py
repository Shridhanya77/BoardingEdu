import re
import uuid
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.db.models import (
    Avg, Case, Count, DecimalField, F, FloatField, IntegerField, Min, OuterRef, Prefetch,
    Q, Subquery, Sum, When, Value,
)
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as django_filters
from apps.fees.models import FeeItem
from apps.geography.models import City, Country, Location, State
from apps.reviews.models import Review
from config.pagination import SchoolDirectoryPagination
from apps.users.permissions import IsStaffAdmin, IsVerifiedSchoolAdmin
from .models import Board, SchoolType, Grade, Facility, School, SchoolPhoto, SchoolVideo, SchoolFacility, SchoolGrade, SchoolFAQ
from .slug_utils import seo_slug
from .services import SchoolVerificationError, set_school_verification_status
from .serializers import (
    BoardDetailSerializer, BoardListSerializer,
    SchoolTypeDetailSerializer, SchoolTypeListSerializer,
    GradeDetailSerializer, GradeListSerializer,
    FacilityDetailSerializer, FacilityListSerializer,
    SchoolDetailSerializer, SchoolListSerializer,
    SchoolFacilityDetailSerializer, SchoolFacilityListSerializer,
    SchoolGradeDetailSerializer, SchoolGradeListSerializer,
    SchoolFAQSerializer,
    SchoolRegistrationSerializer,
    SchoolPortalSerializer,
)


class SchoolFAQViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SchoolFAQSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = SchoolFAQ.objects.filter(status=True)
        for field in ("country", "state", "city", "location", "board", "school_type"):
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(Q(**{f"{field}__isnull": True}) | Q(**{field: value}))
            else:
                queryset = queryset.filter(**{f"{field}__isnull": True})
        return queryset


class ReadWriteModelViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_serializer_class(self):
        if self.action in ('list',) and hasattr(self, 'list_serializer_class'):
            return self.list_serializer_class
        return self.serializer_class


class NullsLastOrderingFilter(filters.OrderingFilter):
    """Keeps schools with missing values at the bottom of the list.

    PostgreSQL sorts NULLs first on a descending order, which would put
    unrated or fee-less schools above the ones the parent is looking for.
    """

    NULLABLE_FIELDS = {'average_rating', 'review_count', 'annual_fee', 'established_year'}

    def get_ordering(self, request, queryset, view):
        ordering = list(super().get_ordering(request, queryset, view) or [])
        if not ordering:
            return ordering
        resolved = []
        for field in ordering:
            bare = field.lstrip('-')
            if bare in self.NULLABLE_FIELDS:
                expression = F(bare)
                resolved.append(
                    expression.desc(nulls_last=True)
                    if field.startswith('-')
                    else expression.asc(nulls_last=True)
                )
            else:
                resolved.append(field)
        # Offset pagination needs a deterministic, unique ordering, otherwise
        # rows can repeat or disappear between pages when the sort key ties.
        requested = {str(item).lstrip('-') for item in ordering}
        if 'school_name' not in requested:
            resolved.append('school_name')
        if 'school_id' not in requested:
            resolved.append('school_id')
        return resolved


class SchoolFilter(django_filters.FilterSet):
    location_group = django_filters.CharFilter(method='filter_location_group')
    home_category = django_filters.CharFilter(method='filter_home_category')
    country = django_filters.ModelChoiceFilter(queryset=Country.objects.all(), method='filter_country')
    state = django_filters.ModelChoiceFilter(queryset=State.objects.all(), method='filter_state')
    city = django_filters.ModelChoiceFilter(queryset=City.objects.all(), method='filter_city')
    location = django_filters.ModelChoiceFilter(queryset=Location.objects.all(), method='filter_location')
    board = django_filters.ModelMultipleChoiceFilter(
        field_name='boards',
        queryset=Board.objects.all(),
    )
    grade = django_filters.ModelMultipleChoiceFilter(
        method='filter_grades',
        queryset=Grade.objects.filter(status=True),
    )
    school_type = django_filters.ModelMultipleChoiceFilter(
        field_name='school_types',
        queryset=SchoolType.objects.all(),
    )
    is_featured = django_filters.BooleanFilter(field_name='is_featured')
    min_fee = django_filters.NumberFilter(method='filter_min_fee')
    max_fee = django_filters.NumberFilter(method='filter_max_fee')

    class Meta:
        model = School
        fields = [
            'country', 'state', 'city', 'location',
            'gender', 'status', 'verification_status', 'boarding_required', 'is_featured',
        ]

    @staticmethod
    def _home_school_categories(school_type):
        value = f'{school_type.type_code} {school_type.slug} {school_type.type_name}'.lower().replace('_', '-')
        if re.search(r'day[- ]boarding', value):
            return {'day-school', 'residential-school'}
        if re.search(r'\bboarding\b|\bresidential\b', value):
            return {'residential-school'}
        if re.search(r'\bday\b|day-school', value):
            return {'day-school'}
        return set()

    def filter_home_category(self, queryset, name, value):
        if value == 'boarding-schools':
            value = 'residential-school'
        if value not in ('day-school', 'residential-school'):
            return queryset.none()
        matching_type_ids = [
            school_type.pk
            for school_type in SchoolType.objects.filter(status=True)
            if value in self._home_school_categories(school_type)
        ]
        if not matching_type_ids:
            return queryset.none()
        return queryset.filter(school_types__in=matching_type_ids).distinct()

    def filter_country(self, queryset, name, country):
        # Keep the denormalized school geography FKs consistent with the hierarchy.
        return queryset.filter(
            country=country,
            state__country=country,
            city__state__country=country,
        ).filter(state_id=F('city__state_id'))

    def filter_state(self, queryset, name, state):
        country = self.form.cleaned_data.get('country')
        if country and state.country_id != country.pk:
            return queryset.none()
        return queryset.filter(
            state=state,
            country=state.country,
            city__state=state,
        )

    def filter_city(self, queryset, name, city):
        state = self.form.cleaned_data.get('state')
        country = self.form.cleaned_data.get('country')
        if (state and city.state_id != state.pk) or (country and city.state.country_id != country.pk):
            return queryset.none()
        return queryset.filter(
            city=city,
            state=city.state,
            country=city.state.country,
        )

    def filter_location(self, queryset, name, location):
        city = self.form.cleaned_data.get('city')
        state = self.form.cleaned_data.get('state')
        country = self.form.cleaned_data.get('country')
        if (city and location.city_id != city.pk) or (state and location.city.state_id != state.pk) or (country and location.city.state.country_id != country.pk):
            return queryset.none()
        return queryset.filter(
            location=location,
            city=location.city,
            state=location.city.state,
            country=location.city.state.country,
        )

    def filter_location_group(self, queryset, name, value):
        raw_groups = self.data.getlist(name) if hasattr(self.data, 'getlist') else [value]
        location_query = Q(pk__in=[])
        for raw_group in raw_groups:
            country_value, separator, raw_states = raw_group.partition('|')
            try:
                country_id = uuid.UUID(country_value)
            except (ValueError, AttributeError):
                return queryset.none()

            if not separator:
                location_query |= Q(country_id=country_id)
                continue

            try:
                state_ids = [uuid.UUID(state_id) for state_id in raw_states.split(',')]
            except (ValueError, AttributeError):
                return queryset.none()
            if not state_ids or State.objects.filter(
                state_id__in=state_ids,
                country_id=country_id,
            ).count() != len(set(state_ids)):
                return queryset.none()
            location_query |= Q(country_id=country_id, state_id__in=state_ids)

        return queryset.filter(location_query)

    def filter_grades(self, queryset, name, grades):
        if not grades:
            return queryset
        return queryset.filter(
            school_grades__grade__in=grades,
            school_grades__is_active=True,
        ).distinct()

    @staticmethod
    def annual_fee_subquery():
        """Starting yearly tuition, not the sum of every class and one-time fee."""
        amount_field = DecimalField(max_digits=14, decimal_places=2)
        annualized = Case(
            When(payment_frequency="MONTHLY", then=F("amount") * Value(12)),
            When(payment_frequency="QUARTERLY", then=F("amount") * Value(4)),
            When(payment_frequency="HALF_YEARLY", then=F("amount") * Value(2)),
            When(payment_frequency="TERM", then=F("amount") * Value(3)),
            When(payment_frequency="ANNUAL", then=F("amount")),
            default=None,
            output_field=amount_field,
        )
        published = Q(
            fee_structure__school_id=OuterRef("pk"),
            fee_structure__status=True,
            fee_structure__published=True,
            amount__isnull=False,
        ) & (
            Q(fee_structure__academic_year__is_current=True)
            | Q(fee_structure__academic_year__year_code__in=["2026-2027", "2026-27"])
        )
        tuition = (
            Q(item_name__icontains="tuition")
            | Q(item_name__icontains="composite")
            | Q(item_name__icontains="annual fee")
        )

        def min_annual(extra=None):
            qs = FeeItem.objects.filter(published).exclude(
                payment_frequency__in=["ONE_TIME", "BY_DISTANCE", "DYNAMIC"],
            )
            if extra is not None:
                qs = qs.filter(extra)
            return (
                qs.annotate(_annual=annualized)
                .filter(_annual__isnull=False)
                .order_by()
                .values("fee_structure__school_id")
                .annotate(total=Min("_annual"))
                .values("total")[:1]
            )

        return Coalesce(
            Subquery(min_annual(tuition), output_field=amount_field),
            Subquery(min_annual(), output_field=amount_field),
            output_field=amount_field,
        )

    def _filter_fee(self, queryset, lookup, value):
        if value is None:
            return queryset
        if 'annual_fee' not in queryset.query.annotations:
            queryset = queryset.annotate(
                annual_fee=self.annual_fee_subquery(),
            )
        return queryset.filter(**{f'annual_fee__{lookup}': value})

    def filter_min_fee(self, queryset, name, value):
        return self._filter_fee(queryset, 'gte', value)

    def filter_max_fee(self, queryset, name, value):
        return self._filter_fee(queryset, 'lte', value)


# ---------- Board ----------
class BoardViewSet(ReadWriteModelViewSet):
    queryset = Board.objects.all()
    serializer_class = BoardDetailSerializer
    list_serializer_class = BoardListSerializer
    search_fields = ['board_code', 'board_name', 'slug']
    filterset_fields = ['status']
    ordering_fields = ['board_name', 'board_code', 'created_at']
    ordering = ['board_name']


# ---------- SchoolType ----------
class SchoolTypeViewSet(ReadWriteModelViewSet):
    http_method_names = ['get', 'head', 'options']
    queryset = SchoolType.objects.all()
    serializer_class = SchoolTypeDetailSerializer
    list_serializer_class = SchoolTypeListSerializer
    search_fields = ['type_code', 'type_name', 'slug']
    filterset_fields = ['status']
    ordering_fields = ['type_name', 'type_code', 'created_at']
    ordering = ['type_name']


# ---------- Grade ----------
class GradeViewSet(ReadWriteModelViewSet):
    queryset = Grade.objects.all()
    serializer_class = GradeDetailSerializer
    list_serializer_class = GradeListSerializer
    search_fields = ['grade_code', 'grade_name']
    filterset_fields = ['status']
    ordering_fields = ['sort_order', 'grade_name', 'grade_code', 'created_at']
    ordering = ['sort_order']


# ---------- Facility ----------
class FacilityViewSet(ReadWriteModelViewSet):
    queryset = Facility.objects.all()
    serializer_class = FacilityDetailSerializer
    list_serializer_class = FacilityListSerializer
    search_fields = ['facility_code', 'facility_name', 'category', 'slug']
    filterset_fields = ['status', 'category']
    ordering_fields = ['category', 'facility_name', 'facility_code', 'created_at']
    ordering = ['category', 'facility_name']


# ---------- School ----------
class SchoolViewSet(ReadWriteModelViewSet):
    queryset = (
        School.objects.select_related(
            'country', 'state', 'city', 'location'
        )
        .prefetch_related(
            'boards',
            'school_types',
            'school_grades__grade',
            'school_facilities__facility',
            Prefetch(
                'photos',
                queryset=SchoolPhoto.objects.filter(status=True).order_by(
                    'sort_order',
                    'created_at',
                ),
                to_attr='active_photos',
            ),
            Prefetch(
                'videos',
                queryset=SchoolVideo.objects.filter(status=True).order_by(
                    'sort_order',
                    'created_at',
                ),
                to_attr='active_videos',
            ),
        )
        .annotate(
            annual_fee=SchoolFilter.annual_fee_subquery(),
            average_rating=Subquery(
                Review.objects.filter(
                    school=OuterRef('pk'),
                    status=Review.STATUS_PUBLISHED,
                )
                .order_by()
                .values('school')
                .annotate(rating_avg=Avg('rating'))
                .values('rating_avg')[:1],
                output_field=FloatField(),
            ),
            academics_rating=Subquery(
                Review.objects.filter(
                    school=OuterRef("pk"),
                    status=Review.STATUS_PUBLISHED,
                    academics_rating__isnull=False,
                )
                .order_by()
                .values("school")
                .annotate(rating_avg=Avg("academics_rating"))
                .values("rating_avg")[:1],
                output_field=FloatField(),
            ),
            facilities_rating=Subquery(
                Review.objects.filter(
                    school=OuterRef("pk"),
                    status=Review.STATUS_PUBLISHED,
                    facilities_rating__isnull=False,
                )
                .order_by()
                .values("school")
                .annotate(rating_avg=Avg("facilities_rating"))
                .values("rating_avg")[:1],
                output_field=FloatField(),
            ),
            safety_rating=Subquery(
                Review.objects.filter(
                    school=OuterRef("pk"),
                    status=Review.STATUS_PUBLISHED,
                    safety_rating__isnull=False,
                )
                .order_by()
                .values("school")
                .annotate(rating_avg=Avg("safety_rating"))
                .values("rating_avg")[:1],
                output_field=FloatField(),
            ),
            communication_rating=Subquery(
                Review.objects.filter(
                    school=OuterRef("pk"),
                    status=Review.STATUS_PUBLISHED,
                    communication_rating__isnull=False,
                )
                .order_by()
                .values("school")
                .annotate(rating_avg=Avg("communication_rating"))
                .values("rating_avg")[:1],
                output_field=FloatField(),
            ),
            review_count=Coalesce(
                Subquery(
                    Review.objects.filter(
                        school=OuterRef('pk'),
                        status=Review.STATUS_PUBLISHED,
                    )
                    .order_by()
                    .values('school')
                    .annotate(total=Count('review_id'))
                    .values('total')[:1],
                    output_field=IntegerField(),
                ),
                0,
            ),
        )
        .all()
    )
    serializer_class = SchoolDetailSerializer
    list_serializer_class = SchoolListSerializer
    pagination_class = SchoolDirectoryPagination
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        NullsLastOrderingFilter,
    ]
    filterset_class = SchoolFilter
    filterset_fields = [
        'country', 'state', 'city', 'location',
        'gender', 'status', 'verification_status', 'boarding_required', 'is_featured',
    ]
    search_fields = [
        'school_code', 'school_name', 'short_name', 'slug',
        'address', 'pincode', 'phone', 'email',
        'city__city_name', 'boards__board_name',
    ]
    ordering_fields = [
        'school_name', 'school_code', 'established_year',
        'created_at', 'published_at', 'annual_fee',
        'average_rating', 'review_count', 'is_featured',
    ]
    ordering = ['school_name']

    def get_permissions(self):
        if self.action == 'register':
            return [AllowAny()]
        if self.action == 'mine':
            return [IsAuthenticated(), IsVerifiedSchoolAdmin()]
        if self.action in {
            'verification_queue',
            'verification_history',
            'set_verification_status',
        }:
            return [IsStaffAdmin()]
        return super().get_permissions()

    @action(detail=False, methods=['get', 'patch'], url_path='mine')
    def mine(self, request):
        """Verified school admins read and update their own public profile."""
        school = request.user.school_admin_profile.school
        if request.method.lower() == 'patch':
            serializer = SchoolPortalSerializer(
                school,
                data=request.data,
                partial=True,
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(SchoolPortalSerializer(school).data)

    @action(detail=False, methods=['post'], url_path='register')
    def register(self, request):
        """
        Public school self-registration.
        Creates a PENDING school plus its SCHOOL_ADMIN login; an admin must
        verify the school before that login can obtain a token.
        """
        serializer = SchoolRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        school = serializer.save()
        return Response(
            {
                'school_id': str(school.school_id),
                'school_code': school.school_code,
                'school_name': school.school_name,
                'verification_status': school.verification_status,
                'detail': (
                    'Registration received. Our team will verify your school '
                    'before your account is activated.'
                ),
            },
            status=201,
        )

    @action(detail=False, methods=['get'], url_path='verification-queue')
    def verification_queue(self, request):
        schools = School.objects.filter(
            verification_status=School.VERIFICATION_CHOICES[1][0],
        ).select_related('city', 'state').order_by('updated_at', 'school_name')
        page = self.paginate_queryset(schools)
        if page is not None:
            return self.get_paginated_response(
                SchoolListSerializer(page, many=True).data
            )
        serializer = SchoolListSerializer(schools, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='verification-history')
    def verification_history(self, request, pk=None):
        school = self.get_object()
        events = school.verification_events.select_related('actor')
        return Response([
            {
                'event_id': str(event.event_id),
                'previous_status': event.previous_status,
                'new_status': event.new_status,
                'note': event.note,
                'actor': event.actor.get_username(),
                'created_at': event.created_at,
            }
            for event in events
        ])

    @action(detail=True, methods=['post'], url_path='verification')
    def set_verification_status(self, request, pk=None):
        try:
            school, event = set_school_verification_status(
                school_id=pk,
                actor=request.user,
                new_status=request.data.get('status'),
                note=request.data.get('note'),
            )
        except School.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        except SchoolVerificationError as error:
            return Response({error.field: str(error)}, status=400)

        return Response(
            {
                'school_id': str(school.school_id),
                'verification_status': school.verification_status,
                'event_id': str(event.event_id),
            },
            status=200,
        )

    @action(
        detail=False,
        methods=['get'],
        url_path=r'by-slug/(?P<slug>[^/.]+)',
        name='School by slug',
    )
    def by_slug(self, request, slug=None):
        """
        Direct slug lookup — exactly one DB hit.
        Frontend previously called list({search: slug}) -> loop -> retrieve(uuid).
        Usage: GET /api/schools/schools/by-slug/doon-public-school/
        """
        queryset = self.filter_queryset(self.get_queryset()).filter(status=True)
        school = queryset.filter(slug=slug).first()
        if school is None and slug:
            school = queryset.filter(slug__iexact=slug).first()
        if school is None:
            raise Http404
        serializer = self.get_serializer(school)
        return Response(serializer.data)

    def get_serializer_class(self):
        # Use detail serializer for by-slug action (returns full nested profile)
        if self.action == 'by_slug':
            return self.serializer_class
        return super().get_serializer_class()




# ---------- SchoolFacility ----------
class SchoolFacilityViewSet(ReadWriteModelViewSet):
    queryset = SchoolFacility.objects.select_related(
        'school', 'facility'
    ).all()
    serializer_class = SchoolFacilityDetailSerializer
    list_serializer_class = SchoolFacilityListSerializer
    search_fields = [
        'school__school_code', 'school__school_name',
        'facility__facility_name', 'facility__category',
    ]
    filterset_fields = ['school', 'facility', 'available', 'facility__category']
    ordering_fields = ['school__school_name', 'facility__category', 'facility__facility_name', 'created_at']
    ordering = ['school__school_name', 'facility__category', 'facility__facility_name']



# ---------- SchoolGrade (Grades Offered) ----------
class SchoolGradeViewSet(ReadWriteModelViewSet):
    queryset = SchoolGrade.objects.select_related(
        'school', 'grade'
    ).all()
    serializer_class = SchoolGradeDetailSerializer
    list_serializer_class = SchoolGradeListSerializer
    search_fields = [
        'school__school_code', 'school__school_name',
        'grade__grade_code', 'grade__grade_name',
    ]
    filterset_fields = ['school', 'grade', 'is_active']
    ordering_fields = [
        'school__school_name', 'grade__sort_order', 'created_at',
    ]
    ordering = ['school__school_name', 'grade__sort_order']
