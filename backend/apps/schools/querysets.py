from .models import School


def public_school_queryset(queryset=None):
    base_queryset = queryset if queryset is not None else School.objects.all()
    return base_queryset.filter(
        status=True,
        verification_status=School.VERIFICATION_CHOICES[2][0],
    )


def verification_queue_queryset(queryset=None):
    base_queryset = queryset if queryset is not None else School.objects.all()
    unreviewed_statuses = [status for status, _ in School.VERIFICATION_CHOICES[:2]]
    return base_queryset.filter(verification_status__in=unreviewed_statuses)
