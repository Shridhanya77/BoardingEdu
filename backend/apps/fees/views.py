from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Max, Q
from django.utils import timezone
from rest_framework import serializers, viewsets, filters
from rest_framework.permissions import AllowAny, SAFE_METHODS
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.users.permissions import IsPlatformAdmin
from apps.schools.models import Grade, SchoolGrade, SchoolType
from apps.schools.querysets import public_school_queryset
from .models import AcademicYear, FeeTerm, FeeStructure, FeeItem
from .serializers import (
    AcademicYearSerializer, AcademicYearListSerializer,
    FeeTermSerializer, FeeTermListSerializer,
    FeeStructureSerializer, FeeStructureListSerializer,
    FeeItemSerializer, FeeItemListSerializer,
)


class FeeEstimateInputSerializer(serializers.Serializer):
    school_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=4,
    )
    grade_id = serializers.UUIDField()
    school_type_id = serializers.UUIDField()
    academic_year_id = serializers.UUIDField()


class PublicFeeEstimateView(APIView):
    permission_classes = [AllowAny]

    FREQUENCY_MULTIPLIERS = {
        "ANNUAL": 1,
        "QUARTERLY": 4,
        "HALF_YEARLY": 2,
        "MONTHLY": 12,
    }

    @staticmethod
    def _after_tax(amount, tax_rate_pct):
        return (amount * (Decimal("1") + tax_rate_pct / Decimal("100"))).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

    def post(self, request):
        serializer = FeeEstimateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data

        grade = Grade.objects.filter(pk=values["grade_id"], status=True).first()
        school_type = SchoolType.objects.filter(
            pk=values["school_type_id"],
            status=True,
        ).first()
        if grade is None or school_type is None:
            return Response({"detail": "Choose an active grade and school type."}, status=400)

        school_ids = list(dict.fromkeys(values["school_ids"]))
        schools = list(
            public_school_queryset()
            .filter(school_id__in=school_ids)
            .select_related("city", "state", "country", "location")
            .prefetch_related("school_types")
        )
        school_by_id = {school.school_id: school for school in schools}
        if len(school_by_id) != len(school_ids):
            return Response(
                {"detail": "One or more selected schools are not available for this school type."},
                status=404,
            )

        today = timezone.localdate()
        academic_year = AcademicYear.objects.filter(
            pk=values["academic_year_id"],
            status=True,
        ).first()
        if academic_year is None:
            return Response(
                {"detail": "Choose an active academic year."},
                status=400,
            )

        terms_count = FeeTerm.objects.filter(
            academic_year=academic_year,
            status=True,
        ).count()
        structures = {
            structure.school_id: structure
            for structure in FeeStructure.objects.filter(
                school_id__in=school_ids,
                academic_year=academic_year,
                status=True,
                published=True,
                effective_from__lte=today,
            )
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))
            .select_related("school")
        }

        results = []
        for school_id in school_ids:
            school = school_by_id[school_id]
            if school_type.pk not in {
                item.pk for item in school.school_types.all()
            }:
                results.append(self._unavailable_school(school))
                continue
            if not SchoolGrade.objects.filter(
                school=school,
                grade=grade,
                is_active=True,
            ).exists():
                results.append(self._unavailable_school(school))
                continue
            structure = structures.get(school_id)
            if structure is None:
                results.append(self._unavailable_school(school))
                continue

            items = FeeItem.objects.filter(
                fee_structure=structure,
            ).filter(
                Q(grade__isnull=True) | Q(grade=grade)
            ).filter(
                Q(school_type__isnull=True) | Q(school_type=school_type)
            ).order_by("sort_order", "item_name")
            breakdown = []
            annual_total = Decimal("0.00")
            one_time_total = Decimal("0.00")
            has_unknown_annual = False
            has_unknown_one_time = False

            for item in items:
                amount = item.amount
                frequency = item.payment_frequency
                multiplier = self.FREQUENCY_MULTIPLIERS.get(frequency)
                annualized = None
                one_time = None
                if amount is None:
                    if frequency == "ONE_TIME":
                        has_unknown_one_time = True
                    else:
                        has_unknown_annual = True
                elif frequency == "ONE_TIME":
                    one_time = self._after_tax(amount, item.tax_rate_pct)
                    one_time_total += one_time
                elif frequency == "TERM" and terms_count:
                    annualized = self._after_tax(amount * terms_count, item.tax_rate_pct)
                    annual_total += annualized
                elif multiplier is not None:
                    annualized = self._after_tax(amount * multiplier, item.tax_rate_pct)
                    annual_total += annualized
                else:
                    if frequency == "ONE_TIME":
                        has_unknown_one_time = True
                    else:
                        has_unknown_annual = True

                if frequency == "TERM" and not terms_count:
                    has_unknown_annual = True
                breakdown.append(
                    {
                        "item_name": item.item_name,
                        "category": item.item_category,
                        "frequency": frequency,
                        "amount_per_payment": str(amount) if amount is not None else None,
                        "annualized_amount": str(annualized) if annualized is not None else None,
                        "one_time_amount": str(one_time) if one_time is not None else None,
                        "refundable": item.is_refundable,
                        "variable": annualized is None and one_time is None,
                    }
                )

            if not breakdown:
                results.append(self._unavailable_school(school))
                continue

            annual_value = None if has_unknown_annual else annual_total
            first_year_value = (
                None
                if has_unknown_annual or has_unknown_one_time
                else annual_total + one_time_total
            )
            results.append(
                {
                    **self._school_summary(school),
                    "academic_year": academic_year.year_code,
                    "fees_available": True,
                    "complete": not has_unknown_annual and not has_unknown_one_time,
                    "annual_total": str(annual_value) if annual_value is not None else None,
                    "first_year_total": str(first_year_value) if first_year_value is not None else None,
                    "monthly_recurring_total": (
                        str((annual_value / Decimal("12")).quantize(Decimal("0.01")))
                        if annual_value is not None
                        else None
                    ),
                    "known_annual_subtotal": str(annual_total),
                    "known_one_time_subtotal": str(one_time_total),
                    "last_updated": max(
                        filter(
                            None,
                            [
                                structure.updated_at,
                                items.aggregate(latest=Max("updated_at"))["latest"],
                            ],
                        ),
                        default=None,
                    ),
                    "items": breakdown,
                }
            )
        return Response({"results": results})

    @staticmethod
    def _school_summary(school):
        return {
            "school_id": str(school.school_id),
            "school_name": school.school_name,
            "slug": school.slug,
            "city_name": school.city.city_name if school.city_id else "",
            "state_name": school.state.state_name if school.state_id else "",
            "country_slug": school.country.slug if school.country_id else "",
            "state_slug": school.state.slug if school.state_id else "",
            "city_slug": school.city.slug if school.city_id else "",
            "location_slug": school.location.slug if school.location_id else None,
        }

    def _unavailable_school(self, school):
        return {
            **self._school_summary(school),
            "academic_year": None,
            "fees_available": False,
            "complete": False,
            "annual_total": None,
            "first_year_total": None,
            "monthly_recurring_total": None,
            "known_annual_subtotal": "0.00",
            "known_one_time_subtotal": "0.00",
            "last_updated": None,
            "items": [],
        }


class ReadWriteModelViewSet(viewsets.ModelViewSet):
    """Base: split serializers for LIST vs detail operations."""
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [AllowAny()]
        return [IsPlatformAdmin()]

    def get_serializer_class(self):
        if self.action in ('list',) and hasattr(self, 'list_serializer_class'):
            return self.list_serializer_class
        return self.serializer_class

    def is_platform_admin(self):
        user = self.request.user
        return bool(
            user.is_authenticated
            and (
                user.is_superuser
                or getattr(user, "role", None) in {"STAFF_ADMIN", "SUPER_ADMIN"}
            )
        )


class AcademicYearViewSet(ReadWriteModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    list_serializer_class = AcademicYearListSerializer
    search_fields = ['year_code', 'year_name']
    filterset_fields = ['is_current', 'status']
    ordering_fields = ['year_name', 'year_code', 'start_date', 'created_at']
    ordering = ['-start_date']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method in SAFE_METHODS and not self.is_platform_admin():
            return queryset.filter(status=True)
        return queryset


class FeeTermViewSet(ReadWriteModelViewSet):
    queryset = FeeTerm.objects.select_related('academic_year').all()
    serializer_class = FeeTermSerializer
    list_serializer_class = FeeTermListSerializer
    search_fields = ['term_code', 'term_name', 'academic_year__year_code', 'academic_year__year_name']
    filterset_fields = ['status', 'academic_year', 'term_frequency']
    ordering_fields = ['term_name', 'term_code', 'start_date', 'created_at']
    ordering = ['academic_year__start_date', 'start_date']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method in SAFE_METHODS and not self.is_platform_admin():
            return queryset.filter(status=True, academic_year__status=True)
        return queryset


class FeeStructureViewSet(ReadWriteModelViewSet):
    queryset = FeeStructure.objects.select_related(
        'school', 'academic_year', 'payment_terms'
    ).all()
    serializer_class = FeeStructureSerializer
    list_serializer_class = FeeStructureListSerializer
    filterset_fields = ['school', 'academic_year', 'status', 'published']
    search_fields = [
        'structure_code', 'structure_name',
        'school__school_name', 'school__school_code',
    ]
    ordering_fields = [
        'structure_name', 'structure_code', 'effective_from',
        'created_at', 'published_at',
    ]
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method in SAFE_METHODS and not self.is_platform_admin():
            return queryset.filter(
                status=True,
                published=True,
                school__in=public_school_queryset(),
                academic_year__status=True,
            )
        return queryset


class FeeItemViewSet(ReadWriteModelViewSet):
    queryset = FeeItem.objects.select_related(
        'fee_structure', 'grade', 'school_type'
    ).all()
    serializer_class = FeeItemSerializer
    list_serializer_class = FeeItemListSerializer
    filterset_fields = [
        'item_category', 'grade', 'school_type',
        'is_refundable', 'fee_structure',
    ]
    search_fields = [
        'item_code', 'item_name',
        'fee_structure__structure_code', 'fee_structure__structure_name',
        'grade__grade_name', 'school_type__type_name',
    ]
    ordering_fields = [
        'item_name', 'item_code', 'amount', 'sort_order',
        'created_at',
    ]
    # Cursor pagination requires ordering fields on the model itself (not lookups).
    ordering = ['sort_order', 'item_name', 'item_code']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method in SAFE_METHODS and not self.is_platform_admin():
            return queryset.filter(
                fee_structure__status=True,
                fee_structure__published=True,
                fee_structure__school__in=public_school_queryset(),
                fee_structure__academic_year__status=True,
            )
        return queryset
