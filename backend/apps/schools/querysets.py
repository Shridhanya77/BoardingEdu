import re

from django.db.models import (
    Case,
    DecimalField,
    F,
    Min,
    OuterRef,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import School


def public_school_queryset(queryset=None):
    base_queryset = queryset if queryset is not None else School.objects.all()
    return base_queryset.filter(status=True)


def featured_visibility_q(relation=""):
    """Schools that should appear in the public featured placement.

    A school with no promotion record stays featured when ``is_featured`` is
    set. A promotion record is shown only while it is active and inside its
    optional start and end dates, even if the boolean flag is stale.
    """

    def field(name):
        return f"{relation}__{name}" if relation else name

    today = timezone.localdate()
    promotion = field("featured_promotion")
    window = (
        Q(**{f"{promotion}__is_active": True})
        & (
            Q(**{f"{promotion}__starts_on__isnull": True})
            | Q(**{f"{promotion}__starts_on__lte": today})
        )
        & (
            Q(**{f"{promotion}__ends_on__isnull": True})
            | Q(**{f"{promotion}__ends_on__gte": today})
        )
    )
    legacy = Q(**{field("is_featured"): True}) & Q(**{f"{promotion}__isnull": True})
    return legacy | window


def home_school_categories(school_type):
    """Public home categories a school type belongs to.

    Day boarding belongs to both the day and residential families. Returned
    values match the ``?home_category=`` API filter.
    """
    value = (
        f"{school_type.type_code} {school_type.slug} {school_type.type_name}"
        .lower()
        .replace("_", "-")
    )
    if re.search(r"day[- ]boarding", value):
        return {"day-school", "residential-school"}
    if re.search(r"\bboarding\b|\bresidential\b", value):
        return {"residential-school"}
    if re.search(r"\bday\b|day-school", value):
        return {"day-school"}
    return set()


def school_type_ids_for_home_category(category):
    """School type ids whose family matches ``category``.

    ``boarding-schools`` is accepted as an alias of ``residential-school``.
    """
    from .models import SchoolType

    if category == "boarding-schools":
        category = "residential-school"
    if category not in ("day-school", "residential-school"):
        return []
    return [
        school_type.pk
        for school_type in SchoolType.objects.filter(status=True)
        if category in home_school_categories(school_type)
    ]


def annual_fee_subquery():
    """Starting yearly tuition for a school, annotated as ``annual_fee``.

    Uses only published fee structures for the current academic year and
    prefers tuition-like components, so directory filters and saved-search
    matching agree on a school's fee.
    """
    from apps.fees.models import FeeItem

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
