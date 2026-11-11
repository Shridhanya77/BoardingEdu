"""Branding and statistics for the Django admin.

Kept out of settings.py so the whole admin configuration lives in one place.
Statistics are computed only on the admin index request, never on change forms.
"""
from datetime import timedelta
import re

from django.contrib import admin, messages
from django.conf import settings
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncMonth
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils import timezone

from apps.users.school_admin_scope import (
    BoardingEduAdminAuthenticationForm,
    assigned_school_id,
)
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
    from apps.schools.models import School, SchoolProfileChange
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
        _card("Unverified schools", schools["unverified"], "schools_school_changelist", "warn", "Not yet submitted or rejected"),
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

    pending = schools["pending_verification"]
    pending_profile_changes = SchoolProfileChange.objects.filter(
        status=SchoolProfileChange.STATUS_PENDING
    ).count()
    quick_links = [
        {
            "label": "Verify schools",
            "hint": f"{pending} waiting" if pending else "Queue is clear",
            "url": reverse("admin:schools_school_verification_queue"),
        },
        {
            "label": "Review school profile edits",
            "hint": f"{pending_profile_changes} waiting" if pending_profile_changes else "Queue is clear",
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


def _lead_contact(lead):
    if lead.parent_profile_id and lead.parent_profile.user_id:
        user = lead.parent_profile.user
        return user.phone or user.email or "—"
    return lead.guest_phone or lead.guest_email or "—"


def school_admin_menu(request):
    """Sidebar for a school administrator: their school and the records they can change."""
    school_id = assigned_school_id(request.user)
    school_url = reverse("admin:schools_school_change", args=[school_id])
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
        ("Facilities", f"{reverse('admin:school_workspace')}?campus=ACADEMIC#facilities", None),
        ("Grades", f"{reverse('admin:school_workspace')}?grade_group=PRIMARY#grades", None),
        ("Fees", reverse("admin:fees_feestructure_changelist"), reverse("admin:fees_feestructure_add")),
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
    from apps.schools.models import Facility, SchoolFacility

    action = request.POST.get("campus_action")
    group = (request.POST.get("campus") or "ACADEMIC").upper()
    allowed = {key for key, _label, _hint in CAMPUS_GROUPS}
    if action not in {"yes", "no"} or group not in allowed:
        messages.error(request, "Choose Yes or No for a campus facility.")
        return redirect("admin:school_workspace")
    facility = Facility.objects.filter(pk=request.POST.get("facility") or "", status=True, category__iexact=group).first()
    if facility is None:
        messages.error(request, "That facility is not in this campus group.")
    elif action == "yes":
        SchoolFacility.objects.update_or_create(
            school=school,
            facility=facility,
            defaults={"available": True},
        )
        messages.success(request, f"{facility.facility_name} is marked available.")
    else:
        SchoolFacility.objects.filter(school=school, facility=facility).delete()
        messages.success(request, f"{facility.facility_name} is marked unavailable.")
    return redirect(f"{reverse('admin:school_workspace')}?campus={group}#campus")


def _apply_grade_choice(request, school):
    """Add or remove a grade on the school profile, mirroring the frontend grades panel."""
    from apps.schools.models import Grade, SchoolGrade

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
                row, created = SchoolGrade.objects.get_or_create(
                    school=school,
                    grade=grade,
                    defaults={"seats_available": seats, "is_active": True},
                )
                if not created:
                    row.seats_available = seats
                    row.is_active = True
                    row.save(update_fields=["seats_available", "is_active", "updated_at"])
                messages.success(request, f"{grade.grade_name} is on the profile.")
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
                row.seats_available = seats
                row.save(update_fields=["seats_available", "updated_at"])
                messages.success(request, f"Seats updated for {row.grade.grade_name}.")
    elif action == "remove":
        removed, _ = SchoolGrade.objects.filter(
            pk=request.POST.get("school_grade") or "", school=school
        ).delete()
        if removed:
            messages.success(request, "Grade removed from the profile.")
        else:
            messages.error(request, "That grade is not on this school.")
    else:
        messages.error(request, "Choose an action for the grade.")
    group = (request.POST.get("grade_group") or "PRIMARY").upper()
    if group not in {key for key, _label in GRADE_GROUPS}:
        group = "PRIMARY"
    return redirect(f"{reverse('admin:school_workspace')}?grade_group={group}#grades")


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
    from apps.schools.completeness import build_profile_completion
    from apps.schools.models import Facility, Grade, School, SchoolGrade, SchoolProfileChange

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
            "fee_structures__fee_items",
        )
        .get(pk=school_id)
    )
    if request.method == "POST":
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
            "parent": _lead_parent_name(lead) if open_contacts else "Locked",
            "contact": _lead_contact(lead) if open_contacts else "Subscription required",
            "grade": lead.applying_for_grade.grade_name if lead.applying_for_grade_id else "—",
            "status": lead.get_status_display(),
        })

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
    completion = build_profile_completion(school)
    school_url = reverse("admin:schools_school_change", args=[school.pk])
    section_urls = {
        "fees": reverse("admin:fees_feestructure_changelist"),
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
        "photo_count": sum(1 for photo in school.photos.all() if photo.status),
        "grade_count": sum(1 for row in school.school_grades.all() if row.is_active),
        "facility_count": sum(1 for row in school.school_facilities.all() if row.available),
        "school_url": school_url,
        "leads_url": reverse("admin:admissions_admissionenquiry_changelist"),
        "facilities_url": f"{reverse('admin:school_workspace')}?campus={campus_group}#facilities",
        "grades_url": f"{reverse('admin:school_workspace')}?grade_group={grade_group}#grades",
        "fees_url": reverse("admin:fees_feestructure_changelist"),
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
        context = {"boardingedu_stats": build_stats()}
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
