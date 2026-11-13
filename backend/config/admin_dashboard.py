"""Branding and statistics for the Django admin.

Kept out of settings.py so the whole admin configuration lives in one place.
Statistics are computed only on the admin index request, never on change forms.
"""
from datetime import timedelta
from decimal import Decimal, InvalidOperation
import re
import uuid

from django.contrib import admin, messages
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncMonth
from django.core.validators import URLValidator
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils import timezone

from apps.users.school_admin_scope import (
    BoardingEduAdminAuthenticationForm,
    assigned_school_id,
)
from apps.schools.content_changes import submit_school_content_change
from apps.schools.public_urls import public_school_url

SITE_HEADER = "BoardingEdu Administration"
SITE_TITLE = "BoardingEdu Admin"
INDEX_TITLE = "Platform Overview"

TREND_MONTHS = 6

CAMPUS_GROUPS = (
    ("ACADEMIC", "Classrooms & laboratories", "Add each classroom, laboratory, or academic space."),
    ("SPORTS", "Sports", "Indoor sports, outdoor sports, grounds, and courts."),
    ("ACCOMMODATION", "Hostel", "Hostel capacity only. Do not record which student is in which room."),
    ("DINING", "Dining", "Dining halls, seating, and meal arrangements."),
    ("HEALTH", "Healthcare", "Medical room and staff availability. Do not enter private medical records."),
    ("SAFETY", "Safety", "Facilities parents should know about. Do not publish internal security procedures."),
    ("TRANSPORT", "Transport", "Vehicles and routes. Do not enter student assignments or driver personal details."),
    ("TECHNOLOGY", "Student services", "Library, Wi-Fi, counselling, laundry, and other campus services."),
)

GRADE_GROUPS = (
    ("EARLY", "Early years"),
    ("PRIMARY", "Primary (Classes 1-5)"),
    ("MIDDLE", "Middle (Classes 6-8)"),
    ("SECONDARY", "Secondary (Classes 9-10)"),
    ("SENIOR", "Senior secondary (Classes 11-12)"),
    ("OTHER", "Other grades"),
)


def _card(label, value, url_name=None, tone="neutral", hint="", query=""):
    url = None
    if url_name:
        url = reverse(f"admin:{url_name}")
        if query:
            url = f"{url}?{query}"
    return {
        "label": label,
        "value": value,
        "hint": hint,
        "tone": tone,
        "url": url,
    }


def _enquiry_trend(now):
    """Count new enquiries per month for the last TREND_MONTHS months."""
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for _ in range(TREND_MONTHS - 1):
        start = (start - timedelta(days=1)).replace(day=1)
    from apps.admissions.models import AdmissionEnquiry

    rows = (
        AdmissionEnquiry.objects.filter(created_at__gte=start)
        .annotate(bucket=TruncMonth("created_at"))
        .values("bucket")
        .annotate(n=Count("pk"))
        .order_by("bucket")
    )
    counts = {
        row["bucket"].strftime("%Y-%m"): row["n"]
        for row in rows
        if row["bucket"]
    }

    months = []
    cursor = start
    for _ in range(TREND_MONTHS):
        month_key = cursor.strftime("%Y-%m")
        months.append({
            "label": cursor.strftime("%b"),
            "value": counts.get(month_key, 0),
        })
        cursor = (cursor + timedelta(days=32)).replace(day=1)

    peak = max([month["value"] for month in months] + [1])
    for month in months:
        month["pct"] = max(4, round(month["value"] / peak * 100))
    return months


def build_stats():
    """Aggregate every admin-facing metric with a small, fixed number of queries."""
    from apps.admissions.models import AdmissionEnquiry
    from apps.geography.models import City, Country, Location, State
    from apps.reviews.models import Review
    from apps.schools.models import School, SchoolContentChange, SchoolProfileChange
    from apps.users.models import User

    now = timezone.now()

    schools = School.objects.aggregate(
        total=Count("pk"),
        active=Count("pk", filter=Q(status=True)),
        featured=Count("pk", filter=Q(is_featured=True)),
        verified=Count("pk", filter=Q(verification_status="VERIFIED")),
        pending_verification=Count("pk", filter=Q(verification_status="PENDING")),
        unverified=Count("pk", filter=Q(verification_status="UNVERIFIED")),
        admission_open=Count("pk", filter=Q(admission_open=True, status=True)),
    )

    reviews = Review.objects.aggregate(
        total=Count("pk"),
        pending=Count("pk", filter=Q(status=Review.STATUS_PENDING)),
        published=Count("pk", filter=Q(status=Review.STATUS_PUBLISHED)),
        average=Avg("rating"),
    )

    enquiries = AdmissionEnquiry.objects.aggregate(
        total=Count("pk"),
        new=Count("pk", filter=Q(status="NEW")),
        converted=Count("pk", filter=Q(status="CONVERTED")),
        urgent=Count("pk", filter=Q(priority="URGENT")),
        this_month=Count("pk", filter=Q(created_at__gte=now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))),
    )

    users = User.objects.aggregate(
        total=Count("pk"),
        active=Count("pk", filter=Q(is_active=True)),
        staff=Count("pk", filter=Q(is_staff=True)),
    )
    role_counts = {
        row["role"]: row["n"] for row in User.objects.values("role").annotate(n=Count("pk"))
    }

    gaps = School.objects.aggregate(
        missing_logo=Count("pk", filter=Q(school_logo_url="") | Q(school_logo_url__isnull=True)),
        missing_cover=Count("pk", filter=Q(school_image_url="") | Q(school_image_url__isnull=True)),
        missing_about=Count("pk", filter=Q(about="") | Q(about__isnull=True)),
        missing_locality=Count("pk", filter=Q(location__isnull=True)),
    )
    day_boarding = {
        row["school_types__type_code"]: row["total"]
        for row in School.objects.values("school_types__type_code").annotate(total=Count("pk", distinct=True))
        if row["school_types__type_code"]
    }

    cards = [
        _card("Total Schools", schools["total"], "schools_school_changelist", "info", f"{schools['active']} active"),
        _card("Day schools", day_boarding.get("DAY", 0), "schools_school_changelist", "info", "Type filter is in the school list"),
        _card("Boarding schools", day_boarding.get("FULL-BOARDING", day_boarding.get("BOARDING", 0)), "schools_school_changelist", "brand"),
        _card("Day boarding", day_boarding.get("DAY-BOARDING", 0), "schools_school_changelist", "brand"),
        _card("Verified schools", schools["verified"], "schools_school_changelist", "info", "Approved for public search"),
        _card("Pending Verification", schools["pending_verification"], "schools_school_changelist", "warn", "Needs review"),
        _card("Unverified schools", schools["unverified"], "schools_school_changelist", "warn", "Imported or not yet reviewed"),
        _card("Missing logos", gaps["missing_logo"], "schools_school_changelist", "warn", "Open the missing-logo filter", "profile_gap=logo"),
        _card("Missing cover photos", gaps["missing_cover"], "schools_school_changelist", "warn", "Open the missing-cover filter", "profile_gap=cover"),
        _card("Missing descriptions", gaps["missing_about"], "schools_school_changelist", "warn", "Open the missing-description filter", "profile_gap=about"),
        _card("Missing locality", gaps["missing_locality"], "schools_school_changelist", "warn", "Open the missing-locality filter", "profile_gap=locality"),
        _card("New Enquiries", enquiries["new"], "admissions_admissionenquiry_changelist", "brand", f"{enquiries['total']} total"),
        _card("Active Users", users["active"], "users_user_changelist", "info", f"{role_counts.get('PARENT', 0)} parents"),
        _card("School administrators", role_counts.get("SCHOOL_ADMIN", 0), "users_user_changelist", "info"),
        _card("Pending Reviews", reviews["pending"], "reviews_review_changelist", "warn", "Awaiting moderation"),
    ]

    coverage = [
        {"label": "Published reviews", "value": reviews["published"]},
        {"label": "Average rating", "value": f"{reviews['average']:.2f}" if reviews["average"] else "\u2014"},
        {"label": "Urgent enquiries", "value": enquiries["urgent"]},
        {"label": "Converted enquiries", "value": enquiries["converted"]},
        {"label": "Verified schools", "value": schools["verified"]},
        {"label": "Staff accounts", "value": users["staff"]},
        {"label": "Countries", "value": Country.objects.count()},
        {"label": "States", "value": State.objects.count()},
        {"label": "Cities", "value": City.objects.count()},
        {"label": "Locations", "value": Location.objects.count()},
    ]

    role_labels = dict(User.ROLE_CHOICES)
    roles = [
        {"label": role_labels.get(role, role), "value": count}
        for role, count in sorted(role_counts.items(), key=lambda item: -item[1])
    ]

    recent_enquiries = list(
        AdmissionEnquiry.objects.select_related("school")
        .order_by("-created_at")
        .values("enquiry_id", "enquiry_code", "school__school_name", "status", "created_at")[:6]
    )
    for enquiry in recent_enquiries:
        enquiry["url"] = reverse(
            "admin:admissions_admissionenquiry_change",
            args=[enquiry["enquiry_id"]],
        )
    recent_reviews = [
        {**row, "url": reverse("admin:reviews_review_change", args=[row["review_id"]])}
        for row in Review.objects.filter(status=Review.STATUS_PENDING)
        .select_related("school")
        .order_by("-created_at")
        .values("review_id", "school__school_name", "rating", "author_name", "created_at")[:6]
    ]

    awaiting_verification = (
        schools["pending_verification"] + schools["unverified"]
    )
    pending_school_changes = (
        SchoolProfileChange.objects.filter(
            status=SchoolProfileChange.STATUS_PENDING
        ).count()
        + SchoolContentChange.objects.filter(
            status=SchoolContentChange.STATUS_PENDING
        ).count()
    )
    quick_links = [
        {
            "label": "Verify schools",
            "hint": f"{awaiting_verification} waiting" if awaiting_verification else "Queue is clear",
            "url": reverse("admin:schools_school_verification_queue"),
        },
        {
            "label": "Review school changes",
            "hint": f"{pending_school_changes} waiting" if pending_school_changes else "Queue is clear",
            "url": reverse("admin:schools_school_profile_review_queue"),
        },
        {
            "label": "Review enquiries",
            "hint": f"{enquiries['new']} new",
            "url": reverse("admin:admissions_admissionenquiry_changelist"),
        },
        {
            "label": "Moderate reviews",
            "hint": f"{reviews['pending']} pending",
            "url": reverse("admin:reviews_review_changelist"),
        },
        {
            "label": "Manage schools",
            "hint": f"{schools['verified']} verified",
            "url": reverse("admin:schools_school_changelist"),
        },
    ]

    return {
        "generated_at": now,
        "cards": cards,
        "quick_links": quick_links,
        "coverage": coverage,
        "roles": roles,
        "verification": {
            "verified": schools["verified"],
            "pending": schools["pending_verification"],
            "unverified": schools["unverified"],
            "total": schools["total"] or 1,
        },
        "months": _enquiry_trend(now),
        "total_reviews": reviews["total"],
        "school_total": schools["total"],
        "enquiry_new": enquiries["new"],
        "recent_enquiries": recent_enquiries,
        "recent_reviews": recent_reviews,
        "recent_schools": list(
            School.objects.select_related("country", "state", "city")
            .prefetch_related("school_types")
            .order_by("-created_at")[:6]
        ),
    }


CLOSED_LEAD_STATUSES = ("CONVERTED", "CLOSED_LOST", "SPAM")


def _lead_parent_name(lead):
    if lead.parent_profile_id and lead.parent_profile.user_id:
        user = lead.parent_profile.user
        return user.get_full_name().strip() or user.username
    return lead.guest_full_name or "—"


def _lead_phone(lead):
    if lead.parent_profile_id and lead.parent_profile.user_id:
        return lead.parent_profile.user.phone or "—"
    return lead.guest_phone or "—"


def _lead_email(lead):
    if lead.parent_profile_id and lead.parent_profile.user_id:
        return lead.parent_profile.user.email or "—"
    return lead.guest_email or "—"


def school_admin_menu(request):
    """Sidebar for a school administrator: their school and the records they can change."""
    school_id = assigned_school_id(request.user)
    school_url = reverse("admin:schools_school_change", args=[school_id])
    workspace_url = reverse("admin:school_workspace")
    from apps.schools.models import School

    school = (
        School.objects.select_related("country", "state", "city")
        .filter(pk=school_id)
        .first()
    )
    subscription_url = reverse("admin:school_subscriptions")
    entries = [
        ("School profile", school_url, None),
        ("Leads", reverse("admin:admissions_admissionenquiry_changelist"), None),
        ("Facilities", f"{workspace_url}?section=facilities&campus=ACADEMIC#facilities", None),
        ("Grades", f"{workspace_url}?section=grades&grade_group=PRIMARY#grades", None),
        ("Fees & admissions", f"{workspace_url}?section=fees#fees", None),
        ("Photographs", f"{workspace_url}?section=photographs#photographs", None),
        ("Brochure & documents", f"{workspace_url}?section=documents#documents", None),
        ("Reviews", f"{workspace_url}?section=reviews#reviews", None),
        ("Subscription plans", f"{subscription_url}?section=plans#plans", None),
        ("My plan", f"{subscription_url}?section=plan#plan", None),
        ("Payment history", f"{subscription_url}?section=payments#payments", None),
    ]
    if school and school.status and school.verification_status == "VERIFIED":
        entries.insert(1, ("View in public site", public_school_url(school), None))
    else:
        entries.insert(1, ("Public profile status", school_url, None))
    return [{
        "name": "Your school",
        "app_label": "school_admin",
        "app_url": reverse("admin:school_workspace"),
        "has_module_perms": True,
        "models": [
            {
                "name": name,
                "object_name": name,
                "perms": {"add": add_url is not None, "change": True, "delete": False, "view": True},
                "admin_url": admin_url,
                "add_url": add_url,
                "view_only": False,
            }
            for name, admin_url, add_url in entries
        ],
    }]


def _apply_campus_choice(request, school):
    """Same Yes/No campus control as the school admin frontend."""
    from apps.schools.models import Facility, SchoolContentChange, SchoolFacility

    action = request.POST.get("campus_action")
    group = (request.POST.get("campus") or "ACADEMIC").upper()
    allowed = {key for key, _label, _hint in CAMPUS_GROUPS}
    if action not in {"yes", "no"} or group not in allowed:
        messages.error(request, "Choose Yes or No for a campus facility.")
        return redirect(f"{reverse('admin:school_workspace')}?section=facilities")
    facility = Facility.objects.filter(pk=request.POST.get("facility") or "", status=True, category__iexact=group).first()
    if facility is None:
        messages.error(request, "That facility is not in this campus group.")
    elif action == "yes":
        existing = SchoolFacility.objects.filter(
            school=school, facility=facility
        ).first()
        submit_school_content_change(
            school,
            request.user,
            SchoolContentChange.TYPE_FACILITY,
            f"FACILITY:{facility.pk}",
            {
                "facility_id": str(facility.pk),
                "available": True,
                "quantity_or_capacity": (
                    existing.quantity_or_capacity if existing else None
                ),
                "description": existing.description if existing else "",
            },
            target_id=facility.pk,
        )
        messages.success(
            request,
            f"{facility.facility_name} was sent for Super Admin approval.",
        )
    else:
        submit_school_content_change(
            school,
            request.user,
            SchoolContentChange.TYPE_FACILITY,
            f"FACILITY:{facility.pk}",
            {"facility_id": str(facility.pk)},
            action=SchoolContentChange.ACTION_DELETE,
            target_id=facility.pk,
        )
        messages.success(
            request,
            f"Removing {facility.facility_name} was sent for Super Admin approval.",
        )
    return redirect(
        f"{reverse('admin:school_workspace')}?section=facilities&campus={group}#facilities"
    )


def _apply_grade_choice(request, school):
    """Add or remove a grade on the school profile, mirroring the frontend grades panel."""
    from apps.schools.models import Grade, SchoolContentChange, SchoolGrade

    action = request.POST.get("grade_action")
    if action == "add":
        grade = Grade.objects.filter(pk=request.POST.get("grade") or "", status=True).first()
        if grade is None:
            messages.error(request, "Choose a grade from the list.")
        else:
            seats, invalid = _clean_seats(request.POST.get("seats_available"))
            if invalid:
                messages.error(request, "Seats must be a whole number.")
            else:
                existing = SchoolGrade.objects.filter(
                    school=school, grade=grade
                ).first()
                submit_school_content_change(
                    school,
                    request.user,
                    SchoolContentChange.TYPE_GRADE,
                    f"GRADE:{grade.pk}",
                    {
                        "grade_id": str(grade.pk),
                        "seats_available": seats,
                        "entry_age_min": (
                            existing.entry_age_min if existing else None
                        ),
                        "entry_age_max": (
                            existing.entry_age_max if existing else None
                        ),
                        "is_active": True,
                    },
                    target_id=grade.pk,
                )
                messages.success(
                    request,
                    f"{grade.grade_name} was sent for Super Admin approval.",
                )
    elif action == "seats":
        row = SchoolGrade.objects.filter(
            pk=request.POST.get("school_grade") or "", school=school
        ).first()
        if row is None:
            messages.error(request, "That grade is not on this school.")
        else:
            seats, invalid = _clean_seats(request.POST.get("seats_available"))
            if invalid:
                messages.error(request, "Seats must be a whole number.")
            else:
                submit_school_content_change(
                    school,
                    request.user,
                    SchoolContentChange.TYPE_GRADE,
                    f"GRADE:{row.grade_id}",
                    {
                        "grade_id": str(row.grade_id),
                        "seats_available": seats,
                        "entry_age_min": row.entry_age_min,
                        "entry_age_max": row.entry_age_max,
                        "is_active": row.is_active,
                    },
                    target_id=row.grade_id,
                )
                messages.success(
                    request,
                    f"Seat changes for {row.grade.grade_name} were sent for Super Admin approval.",
                )
    elif action == "remove":
        row = SchoolGrade.objects.filter(
            pk=request.POST.get("school_grade") or "", school=school
        ).select_related("grade").first()
        if row is not None:
            submit_school_content_change(
                school,
                request.user,
                SchoolContentChange.TYPE_GRADE,
                f"GRADE:{row.grade_id}",
                {"grade_id": str(row.grade_id)},
                action=SchoolContentChange.ACTION_DELETE,
                target_id=row.grade_id,
            )
            messages.success(request, "Grade removal was sent for Super Admin approval.")
        else:
            messages.error(request, "That grade is not on this school.")
    else:
        messages.error(request, "Choose an action for the grade.")
    group = (request.POST.get("grade_group") or "PRIMARY").upper()
    if group not in {key for key, _label in GRADE_GROUPS}:
        group = "PRIMARY"
    return redirect(
        f"{reverse('admin:school_workspace')}?section=grades&grade_group={group}#grades"
    )


def _apply_admission_resource(request, school):
    from apps.schools.models import SchoolAdmissionResource, SchoolContentChange

    action = request.POST.get("resource_action")
    if action == "remove":
        try:
            resource_id = uuid.UUID(request.POST.get("resource_id") or "")
        except (ValueError, TypeError):
            messages.error(request, "Choose a valid admission document.")
            return redirect(f"{reverse('admin:school_workspace')}?section=documents#documents")
        resource = SchoolAdmissionResource.objects.filter(
            resource_id=resource_id,
            school=school,
            status=True,
        ).first()
        if resource:
            submit_school_content_change(
                school,
                request.user,
                SchoolContentChange.TYPE_RESOURCE,
                f"RESOURCE:{resource.resource_id}",
                {},
                action=SchoolContentChange.ACTION_DELETE,
                target_id=resource.resource_id,
            )
            messages.success(request, "Document removal was sent for Super Admin approval.")
        else:
            messages.error(request, "That document is not on this school.")
    elif action == "add":
        resource_type = request.POST.get("resource_type") or ""
        title = (request.POST.get("title") or "").strip()
        document_url = (request.POST.get("document_url") or "").strip()
        if resource_type not in dict(SchoolAdmissionResource.RESOURCE_TYPE_CHOICES):
            messages.error(request, "Choose a valid document type.")
        elif not title:
            messages.error(request, "Add a document title.")
        else:
            upload = request.FILES.get("file")
            if upload is not None and document_url:
                messages.error(request, "Choose a PDF upload or a document URL, not both.")
                return redirect(f"{reverse('admin:school_workspace')}?section=documents#documents")
            if upload is not None:
                from apps.dashboards.school_ops import _store_school_document

                document_url, failure = _store_school_document(upload)
                if failure:
                    messages.error(
                        request,
                        str(failure.data.get("detail") or "The PDF could not be uploaded."),
                    )
                    return redirect(f"{reverse('admin:school_workspace')}?section=documents#documents")
            elif document_url:
                try:
                    URLValidator(schemes=["http", "https"])(document_url)
                except DjangoValidationError:
                    messages.error(request, "Enter a valid public HTTP or HTTPS document URL.")
                    return redirect(f"{reverse('admin:school_workspace')}?section=documents#documents")
            if not document_url:
                messages.error(request, "Add a PDF upload or a public document URL.")
            else:
                resource_id = uuid.uuid4()
                resource = SchoolAdmissionResource(
                    resource_id=resource_id,
                    school=school,
                    resource_type=resource_type,
                    title=title,
                    description=(request.POST.get("description") or "").strip(),
                    document_url=document_url,
                    sort_order=school.admission_resources.filter(
                        resource_type=resource_type
                    ).count(),
                )
                try:
                    resource.full_clean()
                except DjangoValidationError as exc:
                    messages.error(request, " ".join(exc.messages))
                else:
                    submit_school_content_change(
                        school,
                        request.user,
                        SchoolContentChange.TYPE_RESOURCE,
                        f"RESOURCE:{resource_id}",
                        {
                            "resource_type": resource_type,
                            "title": title,
                            "description": resource.description,
                            "document_url": document_url,
                            "sort_order": resource.sort_order,
                        },
                        target_id=resource_id,
                    )
                    messages.success(
                        request,
                        f"{title} was sent for Super Admin approval.",
                    )
    else:
        messages.error(request, "Choose an action for the admission document.")
    return redirect(f"{reverse('admin:school_workspace')}?section=documents#documents")


def _fee_workspace_redirect():
    return redirect(f"{reverse('admin:school_workspace')}?section=fees#fees")


def _fee_amount(raw, frequency):
    if raw in ("", None):
        if frequency in {"DYNAMIC", "BY_DISTANCE"}:
            return None
        raise DjangoValidationError("Enter an amount for this fee.")
    try:
        amount = Decimal(str(raw))
    except (InvalidOperation, ValueError):
        raise DjangoValidationError("Enter a valid fee amount.") from None
    if not amount.is_finite():
        raise DjangoValidationError("Enter a finite fee amount.")
    if amount < 0:
        raise DjangoValidationError("Fee amounts cannot be negative.")
    return amount


def _school_fee_structure(school, academic_year):
    from apps.fees.models import FeeStructure

    base_code = re.sub(
        r"[^A-Za-z0-9]+",
        "-",
        f"{school.school_code}-{academic_year.year_code}",
    ).strip("-").upper()[:40].rstrip("-") or "SCHOOL"
    structure_code = base_code
    suffix = 2
    while FeeStructure.objects.filter(structure_code=structure_code).exclude(
        school=school,
        academic_year=academic_year,
    ).exists():
        suffix_text = f"-{suffix}"
        structure_code = f"{base_code[:40 - len(suffix_text)].rstrip('-')}{suffix_text}"
        suffix += 1
    structure, _ = FeeStructure.objects.get_or_create(
        school=school,
        academic_year=academic_year,
        defaults={
            "structure_code": structure_code,
            "structure_name": f"{school.short_name or school.school_name} fees {academic_year.year_code}"[:200],
            "effective_from": academic_year.start_date,
            "effective_to": academic_year.end_date,
            "status": True,
            "published": False,
        },
    )
    return structure


def _apply_fee_action(request, school):
    from apps.fees.models import AcademicYear, FeeItem, FeeStructure
    from apps.schools.models import SchoolContentChange, SchoolGrade

    action = request.POST.get("fee_action")
    if action == "add":
        name = (request.POST.get("item_name") or "").strip()
        category = request.POST.get("item_category") or ""
        frequency = request.POST.get("payment_frequency") or ""
        if not name or len(name) > 200:
            messages.error(request, "Enter a fee name of 200 characters or fewer.")
            return _fee_workspace_redirect()
        if category not in dict(FeeItem.CATEGORY_CHOICES):
            messages.error(request, "Choose a fee category.")
            return _fee_workspace_redirect()
        if frequency not in dict(FeeItem.PAYMENT_FREQUENCY_CHOICES):
            messages.error(request, "Choose how often this fee is charged.")
            return _fee_workspace_redirect()
        try:
            amount = _fee_amount(request.POST.get("amount"), frequency)
        except DjangoValidationError as exc:
            messages.error(request, " ".join(exc.messages))
            return _fee_workspace_redirect()
        grade_id = request.POST.get("grade") or ""
        grade = None
        if grade_id:
            try:
                grade_id = uuid.UUID(grade_id)
            except (TypeError, ValueError):
                messages.error(request, "Choose a valid grade offered by this school.")
                return _fee_workspace_redirect()
            school_grade = SchoolGrade.objects.select_related("grade").filter(
                school=school,
                grade_id=grade_id,
                is_active=True,
                grade__status=True,
            ).first()
            if school_grade is None:
                messages.error(request, "Choose a valid grade offered by this school.")
                return _fee_workspace_redirect()
            grade = school_grade.grade
        academic_year_id = request.POST.get("academic_year") or ""
        if academic_year_id:
            try:
                academic_year_id = uuid.UUID(academic_year_id)
            except (TypeError, ValueError):
                messages.error(request, "Choose a valid active academic year.")
                return _fee_workspace_redirect()
            academic_year = AcademicYear.objects.filter(
                pk=academic_year_id,
                status=True,
            ).first()
        else:
            academic_year = AcademicYear.objects.filter(status=True).order_by(
                "-is_current",
                "-start_date",
            ).first()
        if academic_year is None:
            messages.error(request, "Choose an active academic year before adding fees.")
            return _fee_workspace_redirect()
        structure = _school_fee_structure(school, academic_year)
        item_code = re.sub(r"[^A-Z0-9]+", "-", name.upper()).strip("-")[:24] or "FEE"
        suffix = 2
        while structure.fee_items.filter(
            item_code=item_code,
            grade=grade,
            school_type__isnull=True,
        ).exists():
            suffix_text = f"-{suffix}"
            item_code = f"{item_code[:30 - len(suffix_text)].rstrip('-')}{suffix_text}"
            suffix += 1
        while SchoolContentChange.objects.filter(
            school=school,
            content_type=SchoolContentChange.TYPE_FEE_ITEM,
            status=SchoolContentChange.STATUS_PENDING,
            payload__fee_structure_id=str(structure.pk),
            payload__item_code=item_code,
        ).exists():
            suffix_text = f"-{suffix}"
            item_code = f"{item_code[:30 - len(suffix_text)].rstrip('-')}{suffix_text}"
            suffix += 1
        fee_item_id = uuid.uuid4()
        item = FeeItem(
            fee_item_id=fee_item_id,
            fee_structure=structure,
            item_code=item_code,
            item_name=name,
            item_category=category,
            payment_frequency=frequency,
            grade=grade,
            amount=amount,
            sort_order=structure.fee_items.count(),
        )
        try:
            item.full_clean()
        except DjangoValidationError as exc:
            messages.error(request, " ".join(exc.messages))
        else:
            submit_school_content_change(
                school,
                request.user,
                SchoolContentChange.TYPE_FEE_ITEM,
                f"FEE_ITEM:{fee_item_id}",
                {
                    "fee_structure_id": str(structure.pk),
                    "item_code": item.item_code,
                    "item_name": item.item_name,
                    "item_category": item.item_category,
                    "payment_frequency": item.payment_frequency,
                    "grade_id": str(item.grade_id) if item.grade_id else None,
                    "amount": str(item.amount) if item.amount is not None else None,
                    "is_refundable": item.is_refundable,
                    "description": item.description,
                    "sort_order": item.sort_order,
                },
                target_id=fee_item_id,
            )
            messages.success(
                request,
                f"{name} was sent for Super Admin approval.",
            )
    elif action in {"update", "delete"}:
        try:
            fee_item_id = uuid.UUID(request.POST.get("fee_item_id") or "")
        except (TypeError, ValueError):
            messages.error(request, "Choose a valid fee item.")
            return _fee_workspace_redirect()
        item = FeeItem.objects.select_related("fee_structure").filter(
            fee_item_id=fee_item_id,
            fee_structure__school=school,
        ).first()
        if item is None:
            messages.error(request, "That fee item is not on this school.")
            return _fee_workspace_redirect()
        if action == "delete":
            submit_school_content_change(
                school,
                request.user,
                SchoolContentChange.TYPE_FEE_ITEM,
                f"FEE_ITEM:{item.fee_item_id}",
                {},
                action=SchoolContentChange.ACTION_DELETE,
                target_id=item.fee_item_id,
            )
            messages.success(request, "Fee item removal was sent for Super Admin approval.")
        else:
            name = (request.POST.get("item_name") or "").strip()
            if not name or len(name) > 200:
                messages.error(request, "Enter a fee name of 200 characters or fewer.")
                return _fee_workspace_redirect()
            try:
                item.amount = _fee_amount(request.POST.get("amount"), item.payment_frequency)
            except DjangoValidationError as exc:
                messages.error(request, " ".join(exc.messages))
                return _fee_workspace_redirect()
            item.item_name = name
            try:
                item.full_clean()
            except DjangoValidationError as exc:
                messages.error(request, " ".join(exc.messages))
            else:
                submit_school_content_change(
                    school,
                    request.user,
                    SchoolContentChange.TYPE_FEE_ITEM,
                    f"FEE_ITEM:{item.fee_item_id}",
                    {
                        "fee_structure_id": str(item.fee_structure_id),
                        "item_code": item.item_code,
                        "item_name": item.item_name,
                        "item_category": item.item_category,
                        "payment_frequency": item.payment_frequency,
                        "grade_id": str(item.grade_id) if item.grade_id else None,
                        "amount": str(item.amount) if item.amount is not None else None,
                        "is_refundable": item.is_refundable,
                        "description": item.description,
                        "sort_order": item.sort_order,
                    },
                    target_id=item.fee_item_id,
                )
                messages.success(
                    request,
                    f"Fee changes for {name} were sent for Super Admin approval.",
                )
    elif action in {"publish", "unpublish"}:
        try:
            structure_id = uuid.UUID(request.POST.get("fee_structure_id") or "")
        except (TypeError, ValueError):
            messages.error(request, "Choose a valid fee structure.")
            return _fee_workspace_redirect()
        structure = FeeStructure.objects.filter(
            fee_structure_id=structure_id,
            school=school,
        ).first()
        if structure is None:
            messages.error(request, "That fee structure is not on this school.")
            return _fee_workspace_redirect()
        publish = action == "publish"
        pending_fee_items = SchoolContentChange.objects.filter(
            school=school,
            content_type=SchoolContentChange.TYPE_FEE_ITEM,
            status=SchoolContentChange.STATUS_PENDING,
            payload__fee_structure_id=str(structure.pk),
        ).values_list("payload", flat=True)
        has_pending_amount = any(
            item_payload.get("amount") not in (None, "")
            for item_payload in pending_fee_items
        )
        if (
            publish
            and not structure.fee_items.exclude(amount__isnull=True).exists()
            and not has_pending_amount
        ):
            messages.error(request, "Add at least one fee amount before publishing.")
            return _fee_workspace_redirect()
        submit_school_content_change(
            school,
            request.user,
            SchoolContentChange.TYPE_FEE_STRUCTURE,
            f"FEE_STRUCTURE:{structure.fee_structure_id}",
            {"published": publish},
            action=SchoolContentChange.ACTION_PUBLISH,
            target_id=structure.fee_structure_id,
        )
        messages.success(
            request,
            "Fee publication request sent for Super Admin approval."
            if publish
            else "Fee unpublishing request sent for Super Admin approval.",
        )
    else:
        messages.error(request, "Choose an action for fees.")
    return _fee_workspace_redirect()


def _clean_seats(raw):
    """Returns (seats, invalid). Blank means 'not recorded', which is allowed."""
    if raw in ("", None):
        return None, False
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, True
    if value < 0:
        return None, True
    return value, False


def school_workspace(request):
    """Home for a school administrator: their profile and the leads they received."""
    from apps.admissions.models import AdmissionEnquiry
    from apps.reviews.models import Review
    from apps.schools.completeness import build_profile_completion
    from apps.schools.models import (
        Facility,
        Grade,
        School,
        SchoolAdmissionResource,
        SchoolContentChange,
        SchoolGrade,
        SchoolProfileChange,
    )

    school_id = assigned_school_id(request.user)
    if school_id is None:
        return redirect("admin:index")
    school = (
        School.objects        .select_related("country", "city", "state")
        .prefetch_related(
            "school_types",
            "boards",
            "school_grades",
            "school_facilities__facility",
            "photos",
            "admission_resources",
            "fee_structures__academic_year",
            "fee_structures__fee_items__grade",
        )
        .get(pk=school_id)
    )
    if request.method == "POST":
        if request.POST.get("fee_action"):
            return _apply_fee_action(request, school)
        if request.POST.get("resource_action"):
            return _apply_admission_resource(request, school)
        if request.POST.get("grade_action"):
            return _apply_grade_choice(request, school)
        return _apply_campus_choice(request, school)
    leads = AdmissionEnquiry.objects.filter(school_id=school_id)
    counts = leads.aggregate(
        total=Count("pk"),
        new=Count("pk", filter=Q(status="NEW")),
        open=Count("pk", filter=~Q(status__in=CLOSED_LEAD_STATUSES)),
    )
    status_totals = {
        row["status"]: row["total"]
        for row in leads.values("status").annotate(total=Count("pk"))
    }
    from apps.subscriptions.access import viewer_can_see_contacts

    recent = []
    for lead in leads.select_related(
        "applying_for_grade", "parent_profile__user"
    ).order_by("-created_at")[:8]:
        open_contacts = viewer_can_see_contacts(request.user, lead)
        recent.append({
            "url": reverse("admin:admissions_admissionenquiry_change", args=[lead.pk]),
            "code": lead.enquiry_code,
            "parent": _lead_parent_name(lead) if open_contacts else "Subscription required",
            "phone": _lead_phone(lead) if open_contacts else "Subscription required",
            "email": _lead_email(lead) if open_contacts else "Subscription required",
            "contacts_locked": not open_contacts,
            "grade": lead.applying_for_grade.grade_name if lead.applying_for_grade_id else "—",
            "status": lead.get_status_display(),
        })

    active_section = request.GET.get("section") or "overview"
    allowed_sections = {
        "overview",
        "facilities",
        "grades",
        "fees",
        "photographs",
        "documents",
        "reviews",
    }
    if active_section not in allowed_sections:
        active_section = "overview"
    campus_group = (request.GET.get("campus") or "ACADEMIC").upper()
    campus_labels = {key: (label, hint) for key, label, hint in CAMPUS_GROUPS}
    if campus_group not in campus_labels:
        campus_group = "ACADEMIC"
    saved = {
        row.facility_id: row.available
        for row in school.school_facilities.all()
    }
    campus_facilities = [
        {
            "id": facility.facility_id,
            "name": facility.facility_name,
            "available": saved.get(facility.facility_id, False),
        }
        for facility in Facility.objects.filter(status=True, category__iexact=campus_group).order_by("facility_name")
    ]
    offered_grades = list(
        SchoolGrade.objects.filter(school=school).select_related("grade").order_by("grade__sort_order")
    )
    grades = [
        {"id": row.school_grade_id, "name": row.grade.grade_name, "seats": row.seats_available}
        for row in offered_grades
    ]
    offered_ids = {row.grade_id for row in offered_grades}
    grade_group = (request.GET.get("grade_group") or "PRIMARY").upper()
    if grade_group not in {key for key, _label in GRADE_GROUPS}:
        grade_group = "PRIMARY"
    grade_catalog = [
        {"id": grade.grade_id, "name": grade.grade_name}
        for grade in Grade.objects.filter(status=True).order_by("sort_order")
        if grade.grade_id not in offered_ids and _grade_group(grade.grade_name) == grade_group
    ]
    grades = [
        row for row in grades
        if _grade_group(row["name"]) == grade_group
    ]
    photos = sorted(
        (photo for photo in school.photos.all() if photo.status),
        key=lambda photo: photo.sort_order,
    )
    admission_resources = sorted(
        (resource for resource in school.admission_resources.all() if resource.status),
        key=lambda resource: (resource.sort_order, resource.created_at),
    )
    from apps.fees.models import AcademicYear, FeeItem

    fee_years = list(AcademicYear.objects.filter(status=True).order_by("-is_current", "-start_date"))
    requested_fee_year = request.GET.get("academic_year")
    current_fee_year = next(
        (year for year in fee_years if str(year.pk) == requested_fee_year),
        None,
    )
    if current_fee_year is None and fee_years:
        current_fee_year = fee_years[0]
    fee_structures = list(
        school.fee_structures.select_related("academic_year").prefetch_related(
            "fee_items__grade"
        ).order_by("-academic_year__start_date")
    )
    review_queryset = Review.objects.filter(school=school).select_related("user")
    review_stats = review_queryset.aggregate(
        total=Count("pk"),
        published=Count("pk", filter=Q(status=Review.STATUS_PUBLISHED)),
        pending=Count("pk", filter=Q(status=Review.STATUS_PENDING)),
    )
    reviews = list(review_queryset.order_by("-created_at")[:50])
    completion = build_profile_completion(school)
    school_url = reverse("admin:schools_school_change", args=[school.pk])
    workspace_url = reverse("admin:school_workspace")
    section_urls = {
        "fees": f"{workspace_url}?section=fees#fees",
        "campus": reverse("admin:schools_schoolfacility_changelist"),
        "sports": reverse("admin:schools_schoolfacility_changelist"),
        "hostel": reverse("admin:schools_schoolfacility_changelist"),
        "dining": reverse("admin:schools_schoolfacility_changelist"),
        "healthcare": reverse("admin:schools_schoolfacility_changelist"),
        "safety": reverse("admin:schools_schoolfacility_changelist"),
        "transport": reverse("admin:schools_schoolfacility_changelist"),
        "academics": reverse("admin:schools_schoolgrade_changelist"),
    }
    gaps = [
        {
            "label": section["label"],
            "score": section["score"],
            "url": section_urls.get(section["key"], school_url),
        }
        for section in completion["sections"]
        if section["key"] != "publishing" and section["status"] == "missing"
    ]
    latest_content_change = school.content_changes.order_by(
        "-submitted_at", "-pk"
    ).first()
    context = {
        **admin.site.each_context(request),
        "title": school.school_name,
        "school": school,
        "view_public_url": (
            public_school_url(school)
            if school.status and school.verification_status == "VERIFIED"
            else None
        ),
        "pending_profile_change": SchoolProfileChange.objects.filter(
            school=school,
            status=SchoolProfileChange.STATUS_PENDING,
        ).first(),
        "pending_content_change_count": SchoolContentChange.objects.filter(
            school=school,
            status=SchoolContentChange.STATUS_PENDING,
        ).count(),
        "latest_content_change": latest_content_change,
        "completion_score": completion["score"],
        "gaps": gaps,
        "lead_total": counts["total"],
        "lead_new": counts["new"],
        "lead_open": counts["open"],
        "lead_statuses": [
            {"label": label, "total": status_totals.get(code, 0)}
            for code, label in AdmissionEnquiry.STATUS_CHOICES
        ],
        "recent_leads": recent,
        "photo_count": len(photos),
        "grade_count": sum(1 for row in school.school_grades.all() if row.is_active),
        "facility_count": sum(1 for row in school.school_facilities.all() if row.available),
        "active_section": active_section,
        "school_url": school_url,
        "leads_url": reverse("admin:admissions_admissionenquiry_changelist"),
        "facilities_url": f"{reverse('admin:school_workspace')}?section=facilities&campus={campus_group}#facilities",
        "grades_url": f"{reverse('admin:school_workspace')}?section=grades&grade_group={grade_group}#grades",
        "fees_url": f"{workspace_url}?section=fees#fees",
        "photos_url": f"{reverse('admin:school_workspace')}?section=photographs#photographs",
        "documents_url": f"{reverse('admin:school_workspace')}?section=documents#documents",
        "reviews_url": f"{reverse('admin:school_workspace')}?section=reviews#reviews",
        "subscription_url": reverse("admin:school_subscriptions"),
        "grade_group": grade_group,
        "grade_groups": [
            {"key": key, "label": label, "active": key == grade_group}
            for key, label in GRADE_GROUPS
        ],
        "campus_groups": [
            {"key": key, "label": label, "active": key == campus_group}
            for key, label, _hint in CAMPUS_GROUPS
        ],
        "campus_group": campus_group,
        "campus_label": campus_labels[campus_group][0],
        "campus_hint": campus_labels[campus_group][1],
        "campus_facilities": campus_facilities,
        "grades": grades,
        "grade_catalog": grade_catalog,
        "photos": photos,
        "admission_resources": admission_resources,
        "resource_type_choices": SchoolAdmissionResource.RESOURCE_TYPE_CHOICES,
        "fee_years": fee_years,
        "current_fee_year": current_fee_year,
        "fee_structures": fee_structures,
        "fee_category_choices": FeeItem.CATEGORY_CHOICES,
        "fee_frequency_choices": FeeItem.PAYMENT_FREQUENCY_CHOICES,
        "fee_grades": [
            row for row in offered_grades
            if row.is_active and row.grade.status
        ],
        "reviews": reviews,
        "review_stats": review_stats,
    }
    return render(request, "admin/school_workspace.html", context)


def _grade_group(grade_name):
    normalized = grade_name.lower()
    if any(token in normalized for token in ("nursery", "pre-primary", "preschool", "playgroup", "lkg", "ukg", "kindergarten")):
        return "EARLY"
    numbers = re.findall(r"\d+", normalized)
    if not numbers:
        return "OTHER"
    grade_number = int(numbers[0])
    if grade_number <= 0:
        return "OTHER"
    if grade_number <= 5:
        return "PRIMARY"
    if grade_number <= 8:
        return "MIDDLE"
    if grade_number <= 10:
        return "SECONDARY"
    if grade_number <= 12:
        return "SENIOR"
    return "OTHER"


def school_subscription_page(request):
    """Read-only plan, subscription, and payment details for one school."""
    from apps.schools.models import School
    from apps.subscriptions.access import current_subscription
    from apps.subscriptions.models import SchoolSubscription, SubscriptionPayment, SubscriptionPlan

    school_id = assigned_school_id(request.user)
    if school_id is None:
        return redirect("admin:index")
    school = School.objects.get(pk=school_id)
    context = {
        **admin.site.each_context(request),
        "title": f"Subscription · {school.school_name}",
        "school": school,
        "plans": SubscriptionPlan.objects.filter(status=True),
        "subscriptions": SchoolSubscription.objects.filter(school=school)
        .select_related("plan")
        .order_by("-created_at"),
        "payments": SubscriptionPayment.objects.filter(school=school)
        .select_related("plan")
        .order_by("-created_at")[:50],
        "current_subscription": current_subscription(school),
        "purchase_url": f"{settings.FRONTEND_URL}/dashboard/school",
    }
    return render(request, "admin/school_subscription.html", context)


def install_admin_dashboard():
    """Set admin branding and inject statistics into the admin index view."""
    admin.site.site_header = SITE_HEADER
    admin.site.site_title = SITE_TITLE
    admin.site.index_title = INDEX_TITLE
    admin.site.login_form = BoardingEduAdminAuthenticationForm

    original_index = admin.site.index
    original_has_permission = admin.site.has_permission
    original_get_urls = admin.site.get_urls
    original_get_app_list = admin.site.get_app_list

    def has_permission(request):
        if original_has_permission(request):
            return True
        return assigned_school_id(request.user) is not None

    def index(request, extra_context=None):
        if assigned_school_id(request.user) is not None:
            return redirect("admin:school_workspace")
        stats = build_stats()
        if not (
            request.user.is_superuser
            or getattr(request.user, "role", None) == "SUPER_ADMIN"
        ):
            stats["quick_links"] = [
                link
                for link in stats["quick_links"]
                if link["label"] != "Review school changes"
            ]
        context = {"boardingedu_stats": stats}
        if extra_context:
            context.update(extra_context)
        return original_index(request, extra_context=context)

    def records_index(request, extra_context=None):
        if assigned_school_id(request.user) is not None:
            return redirect("admin:school_workspace")
        context = {
            **admin.site.each_context(request),
            "title": "All records",
            "app_list": admin.site.get_app_list(request),
        }
        if extra_context:
            context.update(extra_context)
        return render(request, "admin/records_index.html", context)

    def get_urls():
        return [
            path(
                "school-workspace/",
                admin.site.admin_view(school_workspace),
                name="school_workspace",
            ),
            path(
                "school-subscriptions/",
                admin.site.admin_view(school_subscription_page),
                name="school_subscriptions",
            ),
            path(
                "records/",
                admin.site.admin_view(records_index),
                name="records_index",
            ),
        ] + original_get_urls()

    def get_app_list(request, app_label=None):
        if assigned_school_id(request.user) is not None:
            if app_label and app_label != "school_admin":
                return []
            return school_admin_menu(request)
        return original_get_app_list(request, app_label)

    admin.site.has_permission = has_permission
    admin.site.index = index
    admin.site.get_urls = get_urls
    admin.site.get_app_list = get_app_list
