from .models import School


def public_school_queryset(queryset=None):
    base_queryset = queryset if queryset is not None else School.objects.all()
    return base_queryset.filter(
        status=True,
        verification_status=School.VERIFICATION_CHOICES[2][0],
    )
