from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import School, SchoolProfileChange


PROFILE_CHANGE_FIELDS = frozenset(
    {
        "school_name",
        "short_name",
        "school_logo_url",
        "school_image_url",
        "country",
        "state",
        "city",
        "location",
        "boards",
        "school_types",
        "gender",
        "established_year",
        "pincode",
        "address",
        "lat",
        "lng",
        "phone",
        "email",
        "website",
        "principal_name",
        "tagline",
        "about",
        "admission_open",
    }
)
PROFILE_FOREIGN_KEYS = frozenset({"country", "state", "city", "location"})
PROFILE_MANY_TO_MANY = frozenset({"boards", "school_types"})


def _primary_key(value):
    return str(value.pk) if hasattr(value, "pk") else str(value)


def _normalize_value(field_name, value):
    if field_name in PROFILE_MANY_TO_MANY:
        return sorted(_primary_key(item) for item in value)
    if field_name in PROFILE_FOREIGN_KEYS:
        return None if value is None else _primary_key(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _current_value(school, field_name):
    if field_name in PROFILE_MANY_TO_MANY:
        return sorted(str(pk) for pk in getattr(school, field_name).values_list("pk", flat=True))
    if field_name in PROFILE_FOREIGN_KEYS:
        value = getattr(school, f"{field_name}_id")
        return None if value is None else str(value)
    return _normalize_value(field_name, getattr(school, field_name))


@transaction.atomic
def submit_school_profile_changes(school, submitted_by, values):
    """Create or replace this school's pending core-profile submission."""
    unsupported = set(values) - PROFILE_CHANGE_FIELDS
    if unsupported:
        raise ValueError("This school profile submission contains an unsupported field.")
    school = School.objects.select_for_update().get(pk=school.pk)
    pending = (
        SchoolProfileChange.objects.select_for_update()
        .filter(school=school, status=SchoolProfileChange.STATUS_PENDING)
        .order_by("-submitted_at", "-pk")
        .first()
    )
    changes = dict(pending.changes) if pending else {}

    for field_name, value in values.items():
        normalized = _normalize_value(field_name, value)
        if normalized == _current_value(school, field_name):
            changes.pop(field_name, None)
        else:
            changes[field_name] = normalized

    if not changes:
        if pending:
            pending.status = SchoolProfileChange.STATUS_WITHDRAWN
            pending.submitted_by = submitted_by
            pending.submitted_at = timezone.now()
            pending.save(update_fields=["status", "submitted_by", "submitted_at"])
        return None

    if pending:
        pending.status = SchoolProfileChange.STATUS_SUPERSEDED
        pending.save(update_fields=["status"])

    return SchoolProfileChange.objects.create(
        school=school,
        changes=changes,
        submitted_by=submitted_by,
    )


def _related_values(field_name, values):
    field = School._meta.get_field(field_name)
    model = field.remote_field.model
    queryset = model._base_manager.filter(pk__in=values)
    objects_by_id = {str(obj.pk): obj for obj in queryset}
    if set(objects_by_id) != set(values):
        raise ValueError(f"One or more selected {field.verbose_name} records no longer exist.")
    return [objects_by_id[value] for value in values]


@transaction.atomic
def review_school_profile_change(change_id, reviewer, approve, note=""):
    change = (
        SchoolProfileChange.objects.select_for_update()
        .select_related("school")
        .get(pk=change_id)
    )
    if change.status != SchoolProfileChange.STATUS_PENDING:
        raise ValueError("This profile submission has already been reviewed.")

    school = School.objects.select_for_update().get(pk=change.school_id)
    if approve:
        scalar_fields = []
        many_to_many_values = {}
        for field_name, value in change.changes.items():
            if field_name not in PROFILE_CHANGE_FIELDS:
                raise ValueError("This profile submission contains an unsupported field.")
            if field_name in PROFILE_MANY_TO_MANY:
                many_to_many_values[field_name] = _related_values(field_name, value)
            elif field_name in PROFILE_FOREIGN_KEYS:
                field = School._meta.get_field(field_name)
                if value is not None and not field.remote_field.model._base_manager.filter(pk=value).exists():
                    raise ValueError(f"The selected {field.verbose_name} no longer exists.")
                setattr(school, f"{field_name}_id", value)
                scalar_fields.append(field_name)
            else:
                setattr(school, field_name, value)
                scalar_fields.append(field_name)

        school.save(update_fields=[*scalar_fields, "updated_at"])
        for field_name, values in many_to_many_values.items():
            getattr(school, field_name).set(values)
        change.status = SchoolProfileChange.STATUS_APPROVED
    else:
        change.status = SchoolProfileChange.STATUS_REJECTED

    change.reviewed_by = reviewer
    change.reviewed_at = timezone.now()
    change.review_note = note.strip()
    change.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note"])
    return change


def _display_related(field_name, value):
    if value is None:
        return "—"
    field = School._meta.get_field(field_name)
    model = field.remote_field.model
    try:
        return str(model._base_manager.get(pk=value))
    except (model.DoesNotExist, ValueError, TypeError):
        return str(value)


def profile_change_rows(change):
    rows = []
    for field_name, proposed in change.changes.items():
        if field_name not in PROFILE_CHANGE_FIELDS:
            continue
        field = School._meta.get_field(field_name)
        current = _current_value(change.school, field_name)
        if field_name in PROFILE_MANY_TO_MANY:
            current = ", ".join(_display_related(field_name, value) for value in current) or "—"
            proposed = ", ".join(_display_related(field_name, value) for value in proposed) or "—"
        elif field_name in PROFILE_FOREIGN_KEYS:
            current = _display_related(field_name, current)
            proposed = _display_related(field_name, proposed)
        elif isinstance(current, bool):
            current = "Yes" if current else "No"
            proposed = "Yes" if proposed else "No"
        else:
            current = str(current) if current not in (None, "") else "—"
            proposed = str(proposed) if proposed not in (None, "") else "—"
        rows.append(
            {
                "label": str(field.verbose_name).capitalize(),
                "current": current,
                "proposed": proposed,
            }
        )
    return rows
