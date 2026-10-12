from django.utils import timezone


def generate_enquiry_code() -> str:
    """Return the next EQ-YYYY-000001 style code for the current calendar year."""
    from .models import AdmissionEnquiry

    year = timezone.now().year
    prefix = f"EQ-{year}-"
    last = (
        AdmissionEnquiry.objects.filter(enquiry_code__startswith=prefix)
        .order_by("-enquiry_code")
        .values_list("enquiry_code", flat=True)
        .first()
    )
    sequence = 1
    if last:
        try:
            sequence = int(str(last).rsplit("-", 1)[-1]) + 1
        except (TypeError, ValueError):
            sequence = 1
    return f"{prefix}{sequence:06d}"


def normalize_child_gender(value: str | None) -> str | None:
    if not value:
        return None
    mapping = {
        "BOY": "MALE",
        "MALE": "MALE",
        "GIRL": "FEMALE",
        "FEMALE": "FEMALE",
        "OTHER": "OTHER",
    }
    return mapping.get(value.strip().upper())
