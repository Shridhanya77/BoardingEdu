"""Parent application tracking APIs.

Parents only see their own enquiries. Schools only see enquiries for their school.
Parents cannot set application_status except by withdrawing their own application.
"""
from pathlib import Path

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from rest_framework.views import APIView

from apps.contact_validation import normalize_phone_number
from apps.notifications.models import ParentNotification
from apps.users.models import User

from .models import ApplicationDocument, ApplicationMessage, AdmissionEnquiry
from .tracking import application_label, mark_withdrawn

MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTO_BYTES = 2 * 1024 * 1024


def _parent_profile(user):
    if getattr(user, "role", None) != User.ROLE_PARENT:
        return None
    return getattr(user, "parent_profile", None)


def _school_id(user):
    if getattr(user, "role", None) != User.ROLE_SCHOOL_ADMIN:
        return None
    return getattr(getattr(user, "school_admin_profile", None), "school_id", None)


def _can_manage_school(user, enquiry):
    role = getattr(user, "role", None)
    if role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN):
        return True
    return role == User.ROLE_SCHOOL_ADMIN and _school_id(user) == enquiry.school_id


def _owns(user, enquiry):
    profile = _parent_profile(user)
    return profile is not None and enquiry.parent_profile_id == profile.pk


def _visible_enquiry(user, enquiry_id):
    enquiry = (
        AdmissionEnquiry.objects.select_related(
            "school",
            "school__city",
            "school__state",
            "academic_year",
            "applying_for_grade",
            "child",
            "child__current_grade",
            "parent_profile__user",
        )
        .filter(enquiry_id=enquiry_id)
        .first()
    )
    if enquiry is None:
        return None
    if _owns(user, enquiry) or _can_manage_school(user, enquiry):
        return enquiry
    return None


def _event_row(event):
    return {
        "event_id": str(event.event_id),
        "status": event.status,
        "status_label": application_label(event.status),
        "remarks": event.remarks,
        "instructions": event.instructions,
        "created_at": event.created_at,
    }


def _document_row(document):
    return {
        "document_id": str(document.document_id),
        "document_type": document.document_type,
        "document_type_label": document.get_document_type_display(),
        "original_name": document.original_name,
        "review_status": document.review_status,
        "created_at": document.created_at,
    }


def _message_row(message):
    author = message.author
    return {
        "message_id": str(message.message_id),
        "body": message.body,
        "created_at": message.created_at,
        "author_name": (author.get_full_name().strip() or author.username) if author else "School",
        "author_role": getattr(author, "role", ""),
    }


def _application_row(enquiry, include_detail=False):
    school = enquiry.school
    child = enquiry.child if enquiry.child_id else None
    row = {
        "enquiry_id": str(enquiry.enquiry_id),
        "enquiry_code": enquiry.enquiry_code,
        "application_status": enquiry.application_status,
        "application_status_label": application_label(enquiry.application_status),
        "crm_status": enquiry.status,
        "created_at": enquiry.created_at,
        "updated_at": enquiry.updated_at,
        "message": enquiry.message,
        "school": {
            "school_id": str(school.school_id),
            "school_name": school.school_name,
            "slug": school.slug,
            "logo_url": school.school_logo_url,
            "address": school.address,
            "phone": school.phone,
            "email": school.email,
            "website": school.website,
            "city_name": school.city.city_name if school.city_id else "",
            "state_name": school.state.state_name if school.state_id else "",
        },
        "grade_name": enquiry.applying_for_grade.grade_name if enquiry.applying_for_grade_id else "",
        "academic_year": enquiry.academic_year.year_code if enquiry.academic_year_id else "",
        "student_name": child.name if child else enquiry.guest_child_name,
    }
    if not include_detail:
        return row
    row["student"] = {
        "name": child.name if child else enquiry.guest_child_name,
        "date_of_birth": child.date_of_birth if child else enquiry.guest_child_dob,
        "gender": child.gender if child else enquiry.guest_child_gender,
        "current_grade": child.current_grade.grade_name if child and child.current_grade_id else "",
    }
    row["timeline"] = [_event_row(event) for event in enquiry.status_events.all()]
    row["documents"] = [_document_row(document) for document in enquiry.documents.all()]
    row["messages"] = [_message_row(message) for message in enquiry.messages.select_related("author")]
    return row


class ParentApplicationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = _parent_profile(request.user)
        if profile is None:
            return Response({"detail": "Applications are available to parent accounts."}, status=403)
        enquiries = (
            AdmissionEnquiry.objects.filter(parent_profile=profile)
            .select_related("school", "school__city", "school__state", "academic_year", "applying_for_grade", "child")
            .order_by("-updated_at")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            enquiries = enquiries.filter(application_status=status_filter)
        return Response([_application_row(enquiry, include_detail=True) for enquiry in enquiries])


class ParentApplicationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, enquiry_id):
        enquiry = _visible_enquiry(request.user, enquiry_id)
        if enquiry is None:
            return Response({"detail": "Application not found."}, status=404)
        if not _owns(request.user, enquiry) and not _can_manage_school(request.user, enquiry):
            return Response({"detail": "Application not found."}, status=404)
        return Response(_application_row(enquiry, include_detail=True))


class ParentWithdrawApplicationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, enquiry_id):
        enquiry = _visible_enquiry(request.user, enquiry_id)
        if enquiry is None or not _owns(request.user, enquiry):
            return Response({"detail": "Application not found."}, status=404)
        if enquiry.application_status in {"REJECTED", "WITHDRAWN", "ACCEPTED"}:
            return Response({"detail": "This application can no longer be withdrawn."}, status=400)
        mark_withdrawn(enquiry, request.data.get("remarks") or "")
        enquiry.refresh_from_db()
        return Response(_application_row(enquiry, include_detail=True))


class ApplicationDocumentUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, enquiry_id):
        enquiry = _visible_enquiry(request.user, enquiry_id)
        if enquiry is None or not _owns(request.user, enquiry):
            return Response({"detail": "Application not found."}, status=404)
        upload = request.FILES.get("file")
        document_type = request.data.get("document_type") or "OTHER"
        allowed_types = {code for code, _label in ApplicationDocument.DOCUMENT_TYPES}
        if document_type not in allowed_types:
            return Response({"detail": "Choose a valid document type."}, status=400)
        if upload is None:
            return Response({"detail": "Choose a file to upload."}, status=400)
        extension = Path(upload.name).suffix.lower()
        if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
            return Response({"detail": "Upload a PDF, JPG, PNG, or WebP file."}, status=400)
        if upload.size > MAX_DOCUMENT_BYTES:
            return Response({"detail": "Documents must be 5 MB or smaller."}, status=400)
        current = enquiry.documents.filter(document_type=document_type).order_by("-created_at").first()
        if current is not None and current.review_status == "VERIFIED":
            return Response({"detail": "A verified document of this type cannot be replaced."}, status=400)
        document = ApplicationDocument.objects.create(
            enquiry=enquiry,
            document_type=document_type,
            file=upload,
            original_name=Path(upload.name).name[:180],
            uploaded_by=request.user,
        )
        return Response(_document_row(document), status=201)


class ApplicationDocumentFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, enquiry_id, document_id):
        enquiry = _visible_enquiry(request.user, enquiry_id)
        if enquiry is None:
            return Response({"detail": "Application not found."}, status=404)
        document = get_object_or_404(ApplicationDocument, document_id=document_id, enquiry=enquiry)
        document.file.open("rb")
        response = FileResponse(document.file, as_attachment=False, filename=document.original_name or "document")
        response["Cache-Control"] = "private, no-store"
        return response


class ApplicationDocumentReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, enquiry_id, document_id):
        enquiry = _visible_enquiry(request.user, enquiry_id)
        if enquiry is None or not _can_manage_school(request.user, enquiry):
            return Response({"detail": "Application not found."}, status=404)
        review_status = request.data.get("review_status")
        allowed = {code for code, _label in ApplicationDocument.REVIEW_STATUSES}
        if review_status not in allowed:
            return Response({"detail": "Choose a valid document status."}, status=400)
        document = get_object_or_404(ApplicationDocument, document_id=document_id, enquiry=enquiry)
        document.review_status = review_status
        document.save(update_fields=["review_status"])
        return Response(_document_row(document))


class ApplicationMessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, enquiry_id):
        enquiry = _visible_enquiry(request.user, enquiry_id)
        if enquiry is None:
            return Response({"detail": "Application not found."}, status=404)
        messages = enquiry.messages.select_related("author")
        return Response([_message_row(message) for message in messages])

    def post(self, request, enquiry_id):
        enquiry = _visible_enquiry(request.user, enquiry_id)
        if enquiry is None:
            return Response({"detail": "Application not found."}, status=404)
        if not _owns(request.user, enquiry) and not _can_manage_school(request.user, enquiry):
            return Response({"detail": "Application not found."}, status=404)
        body = (request.data.get("body") or "").strip()
        if not body or len(body) > 2000:
            return Response({"detail": "Enter a message of up to 2000 characters."}, status=400)
        message = ApplicationMessage.objects.create(enquiry=enquiry, author=request.user, body=body)
        if _can_manage_school(request.user, enquiry) and enquiry.parent_profile_id:
            ParentNotification.objects.create(
                user=enquiry.parent_profile.user,
                enquiry=enquiry,
                title=f"New message from {enquiry.school.school_name}",
                body=body[:240],
                kind="message",
            )
        return Response(_message_row(message), status=201)


class ParentNotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _parent_profile(request.user) is None:
            return Response({"detail": "Notifications are available to parent accounts."}, status=403)
        notes = ParentNotification.objects.filter(user=request.user)[:50]
        return Response(
            {
                "unread": ParentNotification.objects.filter(user=request.user, read_at__isnull=True).count(),
                "results": [
                    {
                        "notification_id": str(note.notification_id),
                        "title": note.title,
                        "body": note.body,
                        "kind": note.kind,
                        "enquiry_id": str(note.enquiry_id) if note.enquiry_id else None,
                        "read": note.read_at is not None,
                        "created_at": note.created_at,
                    }
                    for note in notes
                ],
            }
        )


class ParentNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id=None):
        if _parent_profile(request.user) is None:
            return Response({"detail": "Notifications are available to parent accounts."}, status=403)
        now = timezone.now()
        notes = ParentNotification.objects.filter(user=request.user, read_at__isnull=True)
        if notification_id is not None:
            notes = notes.filter(notification_id=notification_id)
        updated = notes.update(read_at=now)
        return Response({"updated": updated})


class ParentProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        profile = _parent_profile(request.user)
        if profile is None:
            return Response({"detail": "This profile is for parent accounts."}, status=403)
        return Response(_profile_payload(request.user, profile))

    def patch(self, request):
        profile = _parent_profile(request.user)
        if profile is None:
            return Response({"detail": "This profile is for parent accounts."}, status=403)
        photo = request.FILES.get("photo")
        if photo is not None:
            extension = Path(photo.name).suffix.lower()
            if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
                return Response({"detail": "Profile photos must be JPG, PNG, or WebP."}, status=400)
            if photo.size > MAX_PHOTO_BYTES:
                return Response({"detail": "Profile photos must be 2 MB or smaller."}, status=400)
        user = request.user
        if "first_name" in request.data:
            user.first_name = str(request.data.get("first_name") or "")[:150]
        if "last_name" in request.data:
            user.last_name = str(request.data.get("last_name") or "")[:150]
        if "phone" in request.data and request.data.get("phone"):
            try:
                user.phone = normalize_phone_number(str(request.data.get("phone")))
            except ValidationError as exc:
                return Response({"phone": exc.detail}, status=400)
        user.save(update_fields=["first_name", "last_name", "phone"])
        if "address" in request.data:
            profile.address = str(request.data.get("address") or "")[:2000]
        if "occupation" in request.data:
            profile.occupation = str(request.data.get("occupation") or "")[:100]
        if photo is not None:
            profile.photo = photo
        profile.save()
        return Response(_profile_payload(user, profile))


class ParentProfilePhotoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = _parent_profile(request.user)
        if profile is None or not profile.photo:
            return Response({"detail": "No profile photo is saved."}, status=404)
        profile.photo.open("rb")
        response = FileResponse(profile.photo, filename="profile-photo")
        response["Cache-Control"] = "private, no-store"
        return response


def _profile_payload(user, profile):
    children = [
        {
            "child_id": str(child.child_id),
            "name": child.name,
            "date_of_birth": child.date_of_birth,
            "gender": child.gender,
            "current_grade": child.current_grade.grade_name if child.current_grade_id else "",
        }
        for child in profile.children.select_related("current_grade")
    ]
    return {
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "address": profile.address,
        "occupation": profile.occupation,
        "has_photo": bool(profile.photo),
        "children": children,
    }
