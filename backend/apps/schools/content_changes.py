import json
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from apps.fees.models import FeeItem, FeeStructure

from .models import (
    Facility,
    Grade,
    SchoolAdmissionResource,
    SchoolContentChange,
    SchoolFacility,
    SchoolGrade,
    SchoolPhoto,
    School,
    SchoolVideo,
)


CONTENT_LABELS = {
    SchoolContentChange.TYPE_FACILITY: "Facility",
    SchoolContentChange.TYPE_GRADE: "Grade",
    SchoolContentChange.TYPE_PHOTO: "Photograph",
    SchoolContentChange.TYPE_RESOURCE: "Admission resource",
    SchoolContentChange.TYPE_VIDEO: "Video",
    SchoolContentChange.TYPE_FEE_ITEM: "Fee item",
    SchoolContentChange.TYPE_FEE_STRUCTURE: "Fee structure",
}


@transaction.atomic
def submit_school_content_change(
    school,
    submitted_by,
    content_type,
    change_key,
    payload,
    action=SchoolContentChange.ACTION_UPSERT,
    target_id=None,
):
    if content_type not in CONTENT_LABELS:
        raise ValueError("This school content type cannot be submitted for review.")
    if action not in dict(SchoolContentChange.ACTION_CHOICES):
        raise ValueError("This school content action is not supported.")

    school = School.objects.select_for_update().get(pk=school.pk)
    pending = (
        SchoolContentChange.objects.select_for_update()
        .filter(
            school=school,
            change_key=change_key,
            status=SchoolContentChange.STATUS_PENDING,
        )
        .first()
    )
    if pending is None:
        return SchoolContentChange.objects.create(
            school=school,
            submitted_by=submitted_by,
            content_type=content_type,
            change_key=change_key,
            action=action,
            target_id=target_id,
            payload=payload,
        )

    if (
        action == SchoolContentChange.ACTION_UPSERT
        and pending.action == SchoolContentChange.ACTION_UPSERT
        and pending.content_type == content_type
    ):
        payload = {**pending.payload, **payload}
    pending.content_type = content_type
    pending.action = action
    pending.target_id = target_id
    pending.payload = payload
    pending.submitted_by = submitted_by
    pending.submitted_at = timezone.now()
    pending.save(
        update_fields=[
            "content_type",
            "action",
            "target_id",
            "payload",
            "submitted_by",
            "submitted_at",
        ]
    )
    return pending


@transaction.atomic
def review_school_content_change(change_id, reviewer, approve, note=""):
    change = (
        SchoolContentChange.objects.select_for_update()
        .select_related("school")
        .get(pk=change_id)
    )
    if change.status != SchoolContentChange.STATUS_PENDING:
        raise ValueError("This school content submission has already been reviewed.")

    if approve:
        _apply_school_content_change(change)
        change.status = SchoolContentChange.STATUS_APPROVED
    else:
        change.status = SchoolContentChange.STATUS_REJECTED

    change.reviewed_by = reviewer
    change.reviewed_at = timezone.now()
    change.review_note = note.strip()
    change.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note"])
    return change


def _apply_school_content_change(change):
    payload = change.payload
    school = change.school
    target_id = change.target_id

    if change.content_type == SchoolContentChange.TYPE_FACILITY:
        facility_id = payload.get("facility_id") or target_id
        if change.action == SchoolContentChange.ACTION_DELETE:
            SchoolFacility.objects.filter(school=school, facility_id=facility_id).delete()
            return
        facility = Facility.objects.get(pk=facility_id, status=True)
        existing = SchoolFacility.objects.filter(
            school=school, facility=facility
        ).first()
        SchoolFacility.objects.update_or_create(
            school=school,
            facility=facility,
            defaults={
                "available": bool(
                    payload.get("available", existing.available if existing else True)
                ),
                "quantity_or_capacity": payload.get(
                    "quantity_or_capacity",
                    existing.quantity_or_capacity if existing else None,
                ),
                "description": payload.get(
                    "description", existing.description if existing else ""
                ),
            },
        )
        return

    if change.content_type == SchoolContentChange.TYPE_GRADE:
        grade_id = payload.get("grade_id") or target_id
        if change.action == SchoolContentChange.ACTION_DELETE:
            SchoolGrade.objects.filter(school=school, grade_id=grade_id).delete()
            return
        grade = Grade.objects.get(pk=grade_id, status=True)
        existing = SchoolGrade.objects.filter(school=school, grade=grade).first()
        SchoolGrade.objects.update_or_create(
            school=school,
            grade=grade,
            defaults={
                "seats_available": payload.get(
                    "seats_available", existing.seats_available if existing else None
                ),
                "entry_age_min": payload.get(
                    "entry_age_min", existing.entry_age_min if existing else None
                ),
                "entry_age_max": payload.get(
                    "entry_age_max", existing.entry_age_max if existing else None
                ),
                "is_active": bool(
                    payload.get("is_active", existing.is_active if existing else True)
                ),
            },
        )
        return

    if change.content_type == SchoolContentChange.TYPE_PHOTO:
        if change.action == SchoolContentChange.ACTION_DELETE:
            SchoolPhoto.objects.filter(school=school, pk=target_id).update(status=False)
            return
        photo = SchoolPhoto(
            photo_id=target_id,
            school=school,
            photo_url=payload["photo_url"],
            caption=payload.get("caption", ""),
            alt_text=payload.get("alt_text", ""),
            category=payload.get("category", "CAMPUS"),
            sort_order=payload.get("sort_order", 0),
            status=True,
        )
        photo.full_clean()
        SchoolPhoto.objects.update_or_create(
            photo_id=target_id,
            school=school,
            defaults={
                "photo_url": photo.photo_url,
                "caption": photo.caption,
                "alt_text": photo.alt_text,
                "category": photo.category,
                "sort_order": photo.sort_order,
                "status": True,
            },
        )
        return

    if change.content_type == SchoolContentChange.TYPE_RESOURCE:
        if change.action == SchoolContentChange.ACTION_DELETE:
            SchoolAdmissionResource.objects.filter(
                school=school, pk=target_id
            ).update(status=False)
            return
        resource = SchoolAdmissionResource(
            resource_id=target_id,
            school=school,
            resource_type=payload["resource_type"],
            title=payload["title"],
            description=payload.get("description", ""),
            document_url=payload.get("document_url", ""),
            sort_order=payload.get("sort_order", 0),
            status=True,
        )
        resource.full_clean()
        SchoolAdmissionResource.objects.update_or_create(
            resource_id=target_id,
            school=school,
            defaults={
                "resource_type": resource.resource_type,
                "title": resource.title,
                "description": resource.description,
                "document_url": resource.document_url,
                "sort_order": resource.sort_order,
                "status": True,
            },
        )
        return

    if change.content_type == SchoolContentChange.TYPE_VIDEO:
        if change.action == SchoolContentChange.ACTION_DELETE:
            SchoolVideo.objects.filter(school=school, pk=target_id).update(status=False)
            return
        video = SchoolVideo(
            video_id=target_id,
            school=school,
            video_url=payload["video_url"],
            thumbnail_url=payload.get("thumbnail_url", ""),
            caption=payload.get("caption", ""),
            category=payload.get("category", "CAMPUS"),
            sort_order=payload.get("sort_order", 0),
            status=bool(payload.get("status", True)),
        )
        video.full_clean()
        SchoolVideo.objects.update_or_create(
            video_id=target_id,
            school=school,
            defaults={
                "video_url": video.video_url,
                "thumbnail_url": video.thumbnail_url,
                "caption": video.caption,
                "category": video.category,
                "sort_order": video.sort_order,
                "status": bool(payload.get("status", True)),
            },
        )
        return

    if change.content_type == SchoolContentChange.TYPE_FEE_ITEM:
        if change.action == SchoolContentChange.ACTION_DELETE:
            FeeItem.objects.filter(
                fee_item_id=target_id,
                fee_structure__school=school,
            ).delete()
            return
        existing = FeeItem.objects.filter(
            fee_item_id=target_id,
            fee_structure__school=school,
        ).first()
        structure = FeeStructure.objects.get(
            fee_structure_id=payload.get(
                "fee_structure_id",
                existing.fee_structure_id if existing else None,
            ),
            school=school,
        )
        grade_id = payload.get(
            "grade_id", existing.grade_id if existing else None
        )
        raw_amount = payload.get(
            "amount", existing.amount if existing else None
        )
        try:
            amount = Decimal(str(raw_amount)) if raw_amount is not None else None
        except (InvalidOperation, ValueError):
            raise ValueError("The submitted fee amount is invalid.") from None
        if amount is not None and (not amount.is_finite() or amount < 0):
            raise ValueError("The submitted fee amount is invalid.")
        item = existing or FeeItem(fee_item_id=target_id)
        item.fee_structure = structure
        item.item_code = payload.get(
            "item_code", existing.item_code if existing else ""
        )
        item.item_name = payload.get(
            "item_name", existing.item_name if existing else ""
        )
        item.item_category = payload.get(
            "item_category",
            existing.item_category if existing else "TUITION",
        )
        item.payment_frequency = payload.get(
            "payment_frequency",
            existing.payment_frequency if existing else "ANNUAL",
        )
        item.grade_id = grade_id
        item.amount = amount
        item.is_refundable = bool(
            payload.get(
                "is_refundable", existing.is_refundable if existing else False
            )
        )
        item.description = payload.get(
            "description", existing.description if existing else ""
        )
        item.sort_order = payload.get(
            "sort_order", existing.sort_order if existing else 0
        )
        item.full_clean()
        item.save()
        return

    if change.content_type == SchoolContentChange.TYPE_FEE_STRUCTURE:
        structure = FeeStructure.objects.get(
            fee_structure_id=target_id,
            school=school,
        )
        publish = bool(payload.get("published"))
        if publish and not structure.fee_items.exclude(amount__isnull=True).exists():
            raise ValueError("Approve at least one fee item before publishing this fee structure.")
        structure.published = publish
        structure.status = True
        if publish:
            structure.published_at = timezone.now()
        structure.save(update_fields=["published", "status", "published_at", "updated_at"])
        return

    raise ValueError("This school content submission cannot be applied.")


def _current_content(change):
    school = change.school
    target_id = change.target_id
    payload = change.payload

    if change.content_type == SchoolContentChange.TYPE_FACILITY:
        facility_id = payload.get("facility_id") or target_id
        row = SchoolFacility.objects.filter(school=school, facility_id=facility_id).select_related("facility").first()
        return None if row is None else {
            "facility": row.facility.facility_name,
            "available": row.available,
            "quantity_or_capacity": row.quantity_or_capacity,
            "description": row.description,
        }
    if change.content_type == SchoolContentChange.TYPE_GRADE:
        grade_id = payload.get("grade_id") or target_id
        row = SchoolGrade.objects.filter(school=school, grade_id=grade_id).select_related("grade").first()
        return None if row is None else {
            "grade": row.grade.grade_name,
            "seats_available": row.seats_available,
            "is_active": row.is_active,
        }
    if change.content_type == SchoolContentChange.TYPE_PHOTO:
        row = SchoolPhoto.objects.filter(school=school, pk=target_id).first()
        return None if row is None else {
            "photo_url": row.photo_url,
            "caption": row.caption,
            "category": row.category,
            "status": row.status,
        }
    if change.content_type == SchoolContentChange.TYPE_RESOURCE:
        row = SchoolAdmissionResource.objects.filter(school=school, pk=target_id).first()
        return None if row is None else {
            "title": row.title,
            "resource_type": row.resource_type,
            "document_url": row.document_url,
            "status": row.status,
        }
    if change.content_type == SchoolContentChange.TYPE_VIDEO:
        row = SchoolVideo.objects.filter(school=school, pk=target_id).first()
        return None if row is None else {
            "video_url": row.video_url,
            "caption": row.caption,
            "category": row.category,
            "status": row.status,
        }
    if change.content_type == SchoolContentChange.TYPE_FEE_ITEM:
        row = FeeItem.objects.filter(
            fee_item_id=target_id,
            fee_structure__school=school,
        ).first()
        return None if row is None else {
            "item_name": row.item_name,
            "amount": str(row.amount) if row.amount is not None else None,
            "item_category": row.item_category,
            "payment_frequency": row.payment_frequency,
            "description": row.description,
        }
    if change.content_type == SchoolContentChange.TYPE_FEE_STRUCTURE:
        row = FeeStructure.objects.filter(school=school, pk=target_id).first()
        return None if row is None else {
            "structure_name": row.structure_name,
            "published": row.published,
        }
    return None


def content_change_rows(change):
    if change.action == SchoolContentChange.ACTION_DELETE:
        proposed = "Remove from the public profile"
    else:
        proposed = change.payload
    if change.content_type == SchoolContentChange.TYPE_FEE_STRUCTURE:
        proposed = {"published": bool(change.payload.get("published"))}
    elif change.content_type == SchoolContentChange.TYPE_FEE_ITEM:
        proposed = {
            key: value
            for key, value in change.payload.items()
            if key not in {"fee_structure_id", "grade_id", "item_code"}
        }
    elif change.content_type in {SchoolContentChange.TYPE_FACILITY, SchoolContentChange.TYPE_GRADE}:
        proposed = {
            key: value
            for key, value in change.payload.items()
            if key not in {"facility_id", "grade_id"}
        }
        if change.content_type == SchoolContentChange.TYPE_FACILITY:
            facility = Facility.objects.filter(
                pk=change.payload.get("facility_id") or change.target_id
            ).first()
            if facility:
                proposed = {"facility": facility.facility_name, **proposed}
        else:
            grade = Grade.objects.filter(
                pk=change.payload.get("grade_id") or change.target_id
            ).first()
            if grade:
                proposed = {"grade": grade.grade_name, **proposed}
    current = _current_content(change)
    return [
        {
            "label": CONTENT_LABELS.get(change.content_type, "Details"),
            "current": json.dumps(current, ensure_ascii=True, default=str) if current else "Not currently public",
            "proposed": json.dumps(proposed, ensure_ascii=True, default=str),
        }
    ]
