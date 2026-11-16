from django.db.models import Q
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
