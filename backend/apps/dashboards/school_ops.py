"""School-admin operations scoped to the authenticated administrator's school.

Every write ignores a school id supplied by the client and uses the school
on SchoolAdminProfile. Another school's records are not visible and not editable.
"""
from __future__ import annotations

import re
import uuid
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.fees.models import AcademicYear, FeeItem, FeeStructure
from apps.schools.completeness import build_profile_completion
from apps.schools.models import Board, Facility, Grade, School, SchoolFacility, SchoolGrade, SchoolPhoto, SchoolType
from apps.users.models import User
from config.school_media import _public_media_url, _r2_bucket, _r2_client

MAX_IMAGE_BYTES = 8 * 1024 * 1024
IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


def school_for_admin(user):
    if getattr(user, "role", None) != User.ROLE_SCHOOL_ADMIN or not user.is_authenticated:
        return None
    try:
        return user.school_admin_profile.school
    except ObjectDoesNotExist:
        return None


def load_admin_school(user):
    school = school_for_admin(user)
    if school is None:
        return None
    return (
        School.objects.select_related("city", "state", "country", "location")
        .prefetch_related(
            "school_types",
            "boards",
            "school_grades__grade",
            "school_facilities__facility",
            "photos",
            "fee_structures__academic_year",
            "fee_structures__fee_items__grade",
        )
        .get(pk=school.pk)
    )


def _facility_row(row):
    return {
        "school_facility_id": str(row.school_facility_id),
        "facility": str(row.facility_id),
        "facility_name": row.facility.facility_name,
        "category": (row.facility.category or "").upper(),
        "available": row.available,
        "quantity_or_capacity": row.quantity_or_capacity,
        "description": row.description,
    }


def _grade_row(row):
    return {
        "school_grade_id": str(row.school_grade_id),
        "grade": str(row.grade_id),
        "grade_name": row.grade.grade_name,
        "grade_code": row.grade.grade_code,
        "seats_available": row.seats_available,
        "is_active": row.is_active,
    }


def _photo_row(row):
    return {
        "photo_id": str(row.photo_id),
        "photo_url": row.photo_url,
        "caption": row.caption,
        "alt_text": row.alt_text,
        "category": row.category,
        "sort_order": row.sort_order,
    }


def _fee_row(structure):
    return {
        "fee_structure_id": str(structure.fee_structure_id),
        "structure_name": structure.structure_name,
        "year_code": structure.academic_year.year_code,
        "published": structure.published,
        "status": structure.status,
        "items": [
            {
                "fee_item_id": str(item.fee_item_id),
                "item_name": item.item_name,
                "item_category": item.item_category,
                "payment_frequency": item.payment_frequency,
                "amount": str(item.amount) if item.amount is not None else None,
                "is_refundable": item.is_refundable,
                "grade_name": item.grade.grade_name if item.grade_id else "All grades",
                "description": item.description,
            }
            for item in structure.fee_items.all()
        ],
    }


def _metrics(school):
    facilities = list(school.school_facilities.all())
    labs = classrooms = sports = 0
    hostel_capacity = 0
    for row in facilities:
        if not row.available:
            continue
        name = (row.facility.facility_name or "").lower()
        category = (row.facility.category or "").upper()
        quantity = row.quantity_or_capacity or 0
        if category == "SPORTS":
            sports += 1
        if category == "ACCOMMODATION":
            hostel_capacity += quantity
        if "lab" in name:
            labs += 1
        if "class" in name:
            classrooms += 1
    academic = sum(
        1
        for row in facilities
        if row.available and (row.facility.category or "").upper() == "ACADEMIC"
    )
    return {
        "classrooms": classrooms,
        "laboratories": labs,
        "academic_facilities": academic,
        "sports_facilities": sports,
        "hostel_capacity": hostel_capacity,
        "photographs": sum(1 for row in school.photos.all() if row.status),
    }


def build_school_admin_payload(user, enquiry_rows):
    """enquiry_rows is a callable returning recent enquiry dicts, or None to hide them."""
    school = load_admin_school(user)
    if school is None:
        return None
    verified = school.verification_status == "VERIFIED"
    current_year = AcademicYear.objects.filter(is_current=True, status=True).first()
    completion = build_profile_completion(school)
    return {
        "panel_access": "admin" if verified else "pending",
        "academic_year": current_year.year_code if current_year else "",
        "school": {
            "school_id": str(school.school_id),
            "school_name": school.school_name,
            "school_code": school.school_code,
            "slug": school.slug,
            "verification_status": school.verification_status,
            "status": school.status,
            "city_name": school.city.city_name,
            "state_name": school.state.state_name,
            "country_slug": school.country.slug,
            "state_slug": school.state.slug,
            "city_slug": school.city.slug,
            "location_slug": school.location.slug if school.location_id else None,
            "school_logo_url": school.school_logo_url,
            "school_image_url": school.school_image_url,
            "gender": school.gender,
            "admission_open": school.admission_open,
            "short_name": school.short_name,
            "tagline": school.tagline,
            "about": school.about,
            "website": school.website,
            "phone": school.phone,
            "email": school.email,
            "principal_name": school.principal_name,
            "address": school.address,
            "pincode": school.pincode,
            "established_year": school.established_year,
            "boards": [str(board.pk) for board in school.boards.all()],
            "school_type_ids": [str(school_type.pk) for school_type in school.school_types.all()],
            "school_types_detail": [
                {
                    "school_type_id": str(school_type.school_type_id),
                    "type_code": school_type.type_code,
                    "type_name": school_type.type_name,
                    "slug": school_type.slug,
                    "status": school_type.status,
                }
                for school_type in school.school_types.all()
            ],
            "profile_completeness": completion["score"],
            "profile_gaps": [
                item["label"]
                for section in completion["sections"]
                for item in section["items"]
                if item["status"] == "missing"
            ],
        },
        "completion": completion,
        "metrics": _metrics(school),
        "facilities": [_facility_row(row) for row in school.school_facilities.all()],
        "grades": [_grade_row(row) for row in school.school_grades.all()],
        "photos": [
            _photo_row(row)
            for row in school.photos.all()
            if row.status
        ],
        "fees": [_fee_row(row) for row in school.fee_structures.all()],
        "catalog": {
            "facilities": [
                {
                    "facility_id": str(row.facility_id),
                    "facility_name": row.facility_name,
                    "category": (row.category or "").upper(),
                }
                for row in Facility.objects.filter(status=True).order_by("category", "facility_name")
            ],
            "boards": [
                {"board_id": str(row.board_id), "board_name": row.board_name}
                for row in Board.objects.filter(status=True).order_by("board_name")
            ],
            "school_types": [
                {
                    "school_type_id": str(row.school_type_id),
                    "type_name": row.type_name,
                    "type_code": row.type_code,
                }
                for row in SchoolType.objects.filter(status=True).order_by("type_name")
            ],
            "grades": [
                {
                    "grade_id": str(row.grade_id),
                    "grade_name": row.grade_name,
                    "grade_code": row.grade_code,
                }
                for row in Grade.objects.filter(status=True).order_by("sort_order")
            ],
            "photo_categories": [
                {"value": code, "label": label} for code, label in SchoolPhoto.CATEGORY_CHOICES
            ],
            "fee_categories": [
                {"value": code, "label": label} for code, label in FeeItem.CATEGORY_CHOICES
            ],
            "fee_frequencies": [
                {"value": code, "label": label} for code, label in FeeItem.PAYMENT_FREQUENCY_CHOICES
            ],
        },
        "recent_enquiries": enquiry_rows() if enquiry_rows else [],
    }


class SchoolAdminAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def owned_school(self, request):
        school = school_for_admin(request.user)
        if school is None:
            return None, Response(
                {"detail": "This action is for a school administrator assigned to a school."},
                status=403,
            )
        return school, None


class SchoolFacilityWriteView(SchoolAdminAPIView):
    def post(self, request):
        school, error = self.owned_school(request)
        if error:
            return error
        facility = Facility.objects.filter(pk=request.data.get("facility"), status=True).first()
        if facility is None:
            return Response({"detail": "Choose a facility from the list."}, status=400)
        quantity = request.data.get("quantity_or_capacity")
        if quantity in ("", None):
            quantity = None
        else:
            try:
                quantity = int(quantity)
            except (TypeError, ValueError):
                return Response({"detail": "Capacity must be a whole number."}, status=400)
            if quantity < 0:
                return Response({"detail": "Capacity cannot be negative."}, status=400)
        row, _created = SchoolFacility.objects.get_or_create(
            school=school,
            facility=facility,
            defaults={
                "available": bool(request.data.get("available", True)),
                "quantity_or_capacity": quantity,
                "description": str(request.data.get("description") or "")[:500],
            },
        )
        if not _created:
            row.available = bool(request.data.get("available", True))
            row.quantity_or_capacity = quantity
            row.description = str(request.data.get("description") or "")[:500]
            row.save()
        row.facility = facility
        return Response(_facility_row(row), status=201)

    def patch(self, request, school_facility_id):
        school, error = self.owned_school(request)
        if error:
            return error
        row = (
            SchoolFacility.objects.select_related("facility")
            .filter(pk=school_facility_id, school=school)
            .first()
        )
        if row is None:
            return Response({"detail": "Facility not found."}, status=404)
        if "available" in request.data:
            row.available = bool(request.data.get("available"))
        if "quantity_or_capacity" in request.data:
            quantity = request.data.get("quantity_or_capacity")
            if quantity in ("", None):
                row.quantity_or_capacity = None
            else:
                try:
                    quantity = int(quantity)
                except (TypeError, ValueError):
                    return Response({"detail": "Capacity must be a whole number."}, status=400)
                if quantity < 0:
                    return Response({"detail": "Capacity cannot be negative."}, status=400)
                row.quantity_or_capacity = quantity
        if "description" in request.data:
            row.description = str(request.data.get("description") or "")[:500]
        row.save()
        return Response(_facility_row(row))

    def delete(self, request, school_facility_id):
        school, error = self.owned_school(request)
        if error:
            return error
        deleted, _ = SchoolFacility.objects.filter(pk=school_facility_id, school=school).delete()
        if not deleted:
            return Response({"detail": "Facility not found."}, status=404)
        return Response({"deleted": True})


class SchoolGradeWriteView(SchoolAdminAPIView):
    def post(self, request):
        school, error = self.owned_school(request)
        if error:
            return error
        grade = Grade.objects.filter(pk=request.data.get("grade"), status=True).first()
        if grade is None:
            return Response({"detail": "Choose a grade from the list."}, status=400)
        seats = request.data.get("seats_available")
        if seats in ("", None):
            seats = None
        else:
            try:
                seats = int(seats)
            except (TypeError, ValueError):
                return Response({"detail": "Seats must be a whole number."}, status=400)
            if seats < 0:
                return Response({"detail": "Seats cannot be negative."}, status=400)
        row, created = SchoolGrade.objects.get_or_create(
            school=school,
            grade=grade,
            defaults={"seats_available": seats, "is_active": True},
        )
        if not created:
            row.seats_available = seats
            row.is_active = True
            row.save()
        row.grade = grade
        return Response(_grade_row(row), status=201)

    def delete(self, request, school_grade_id):
        school, error = self.owned_school(request)
        if error:
            return error
        deleted, _ = SchoolGrade.objects.filter(pk=school_grade_id, school=school).delete()
        if not deleted:
            return Response({"detail": "Grade not found."}, status=404)
        return Response({"deleted": True})


class SchoolPhotoWriteView(SchoolAdminAPIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):
        school, error = self.owned_school(request)
        if error:
            return error
        upload = request.FILES.get("image")
        photo_url = (request.data.get("photo_url") or "").strip()
        if upload is not None:
            stored, failure = _store_image(upload)
            if failure:
                return failure
            photo_url = stored
        if not photo_url.startswith(("http://", "https://", "/media/schools/")):
            return Response({"detail": "Add an image file or a public image URL."}, status=400)
        category = request.data.get("category") or "CAMPUS"
        allowed = {code for code, _label in SchoolPhoto.CATEGORY_CHOICES}
        if category not in allowed:
            return Response({"detail": "Choose a photograph category."}, status=400)
        row = SchoolPhoto.objects.create(
            school=school,
            photo_url=photo_url[:500],
            caption=str(request.data.get("caption") or "")[:200],
            alt_text=str(request.data.get("alt_text") or "")[:250],
            category=category,
            sort_order=int(school.photos.count()),
            status=True,
        )
        return Response(_photo_row(row), status=201)

    def patch(self, request, photo_id):
        school, error = self.owned_school(request)
        if error:
            return error
        row = SchoolPhoto.objects.filter(pk=photo_id, school=school).first()
        if row is None:
            return Response({"detail": "Photograph not found."}, status=404)
        if "caption" in request.data:
            row.caption = str(request.data.get("caption") or "")[:200]
        if "alt_text" in request.data:
            row.alt_text = str(request.data.get("alt_text") or "")[:250]
        if "category" in request.data:
            allowed = {code for code, _label in SchoolPhoto.CATEGORY_CHOICES}
            if request.data.get("category") not in allowed:
                return Response({"detail": "Choose a photograph category."}, status=400)
            row.category = request.data.get("category")
        if "sort_order" in request.data:
            try:
                row.sort_order = max(0, int(request.data.get("sort_order")))
            except (TypeError, ValueError):
                return Response({"detail": "Order must be a whole number."}, status=400)
        row.save()
        return Response(_photo_row(row))

    def delete(self, request, photo_id):
        school, error = self.owned_school(request)
        if error:
            return error
        deleted, _ = SchoolPhoto.objects.filter(pk=photo_id, school=school).delete()
        if not deleted:
            return Response({"detail": "Photograph not found."}, status=404)
        return Response({"deleted": True})


class SchoolFeeItemWriteView(SchoolAdminAPIView):
    def post(self, request):
        school, error = self.owned_school(request)
        if error:
            return error
        structure = _own_structure(school, request.data.get("fee_structure"))
        if structure is None:
            year = AcademicYear.objects.filter(status=True).order_by("-is_current", "-start_date").first()
            if year is None:
                return Response(
                    {"detail": "No academic year exists yet. A platform admin has to add one first."},
                    status=400,
                )
            code = f"{school.school_code}-{year.year_code}"[:40]
            structure, _created = FeeStructure.objects.get_or_create(
                school=school,
                academic_year=year,
                defaults={
                    "structure_code": code,
                    "structure_name": f"{school.short_name or school.school_name} {year.year_code}"[:200],
                    "effective_from": year.start_date,
                    "status": True,
                    "published": False,
                },
            )
        category = request.data.get("item_category") or "TUITION"
        frequency = request.data.get("payment_frequency") or "ANNUAL"
        if category not in {code for code, _label in FeeItem.CATEGORY_CHOICES}:
            return Response({"detail": "Choose a fee category."}, status=400)
        if frequency not in {code for code, _label in FeeItem.PAYMENT_FREQUENCY_CHOICES}:
            return Response({"detail": "Choose how often this fee is charged."}, status=400)
        name = str(request.data.get("item_name") or "").strip()
        if not name:
            return Response({"detail": "Name this fee."}, status=400)
        amount, amount_error = _amount(request.data.get("amount"))
        if amount_error:
            return amount_error
        grade = None
        if request.data.get("grade"):
            grade = Grade.objects.filter(pk=request.data.get("grade"), status=True).first()
            if grade is None:
                return Response({"detail": "Choose a valid grade."}, status=400)
        item_code = _unique_item_code(structure, name)
        item = FeeItem.objects.create(
            fee_structure=structure,
            item_code=item_code,
            item_name=name[:200],
            item_category=category,
            payment_frequency=frequency,
            grade=grade,
            amount=amount,
            is_refundable=bool(request.data.get("is_refundable", False)),
            description=str(request.data.get("description") or "")[:500],
        )
        return Response({"fee_item_id": str(item.fee_item_id)}, status=201)

    def patch(self, request, fee_item_id):
        school, error = self.owned_school(request)
        if error:
            return error
        item = (
            FeeItem.objects.select_related("fee_structure")
            .filter(pk=fee_item_id, fee_structure__school=school)
            .first()
        )
        if item is None:
            return Response({"detail": "Fee not found."}, status=404)
        if "amount" in request.data:
            amount, amount_error = _amount(request.data.get("amount"))
            if amount_error:
                return amount_error
            item.amount = amount
        if "item_name" in request.data:
            name = str(request.data.get("item_name") or "").strip()
            if not name:
                return Response({"detail": "Name this fee."}, status=400)
            item.item_name = name[:200]
        if "is_refundable" in request.data:
            item.is_refundable = bool(request.data.get("is_refundable"))
        if "description" in request.data:
            item.description = str(request.data.get("description") or "")[:500]
        item.save()
        return Response({"fee_item_id": str(item.fee_item_id), "amount": str(item.amount) if item.amount is not None else None})


class SchoolFeePublishView(SchoolAdminAPIView):
    def post(self, request, fee_structure_id):
        school, error = self.owned_school(request)
        if error:
            return error
        structure = _own_structure(school, fee_structure_id)
        if structure is None:
            return Response({"detail": "Fee structure not found."}, status=404)
        publish = bool(request.data.get("published"))
        if publish and not structure.fee_items.exclude(amount__isnull=True).exists():
            return Response(
                {"detail": "Add at least one fee amount before publishing."},
                status=400,
            )
        structure.published = publish
        structure.status = True
        if publish:
            structure.published_at = timezone.now()
        structure.save(update_fields=["published", "status", "published_at", "updated_at"])
        return Response({"fee_structure_id": str(structure.fee_structure_id), "published": structure.published})


def _own_structure(school, structure_id):
    if not structure_id:
        return None
    return FeeStructure.objects.filter(pk=structure_id, school=school).first()


def _amount(raw):
    if raw in ("", None):
        return None, None
    try:
        amount = Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None, Response({"detail": "Enter a valid amount."}, status=400)
    if amount < 0:
        return None, Response({"detail": "Amount cannot be negative."}, status=400)
    return amount.quantize(Decimal("0.01")), None


def _unique_item_code(structure, name):
    base = re.sub(r"[^A-Z0-9]+", "-", name.upper()).strip("-")[:24] or "FEE"
    candidate = base
    suffix = 2
    while structure.fee_items.filter(item_code=candidate, grade__isnull=True, school_type__isnull=True).exists():
        candidate = f"{base[:20]}-{suffix}"
        suffix += 1
    return candidate[:30]


def _store_image(upload):
    content_type = (getattr(upload, "content_type", "") or "").lower()
    extension = IMAGE_TYPES.get(content_type)
    if extension is None:
        return None, Response({"detail": "Upload a JPG, PNG, WEBP, or GIF image."}, status=400)
    payload = upload.read(MAX_IMAGE_BYTES + 1)
    if not payload:
        return None, Response({"detail": "That image file is empty."}, status=400)
    if len(payload) > MAX_IMAGE_BYTES:
        return None, Response({"detail": "Images must be 8 MB or smaller."}, status=400)
    client = _r2_client()
    if client is None:
        return None, Response(
            {"detail": "Image storage is not configured. Paste a public image URL instead."},
            status=400,
        )
    filename = f"{uuid.uuid4().hex}.{extension}"
    try:
        client.put_object(
            Bucket=_r2_bucket(),
            Key=f"schools/{filename}",
            Body=payload,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
    except Exception:
        return None, Response({"detail": "The image could not be stored. Try again."}, status=502)
    return _public_media_url(filename) or f"/media/schools/{filename}", None
