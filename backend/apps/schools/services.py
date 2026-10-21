from django.db import transaction

from .models import School, SchoolVerificationEvent


class SchoolVerificationError(ValueError):
    def __init__(self, field, message):
        self.field = field
        super().__init__(message)


@transaction.atomic
def set_school_verification_status(*, school_id, actor, new_status, note):
    allowed_statuses = {choice[0] for choice in School.VERIFICATION_CHOICES}
    if not isinstance(new_status, str) or new_status not in allowed_statuses:
        raise SchoolVerificationError("status", "Choose a valid verification status.")
    if not isinstance(note, str) or not note.strip() or len(note.strip()) > 1000:
        raise SchoolVerificationError(
            "note",
            "A note of 1 to 1000 characters is required.",
        )

    school = School.objects.select_for_update().get(pk=school_id)
    previous_status = school.verification_status
    if previous_status == new_status:
        raise SchoolVerificationError(
            "status",
            "The school already has this verification status.",
        )

    school.verification_status = new_status
    school.save(update_fields=["verification_status", "updated_at"])
    event = SchoolVerificationEvent.objects.create(
        school=school,
        previous_status=previous_status,
        new_status=new_status,
        note=note.strip(),
        actor=actor,
    )
    return school, event
