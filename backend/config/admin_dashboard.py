"""Branding and statistics for the Django admin.

Kept out of settings.py so the whole admin configuration lives in one place.
Statistics are computed only on the admin index request, never on change forms.
"""
from datetime import timedelta

from django.contrib import admin
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncMonth
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils import timezone

from apps.users.school_admin_scope import (
    BoardingEduAdminAuthenticationForm,
    assigned_school_id,
)

SITE_HEADER = "BoardingEdu Administration"
SITE_TITLE = "BoardingEdu Admin"
INDEX_TITLE = "Platform Overview"

TREND_MONTHS = 6


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
    from apps.schools.models import School
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
    quick_links = [
        {
            "label": "Verify schools",
            "hint": f"{pending} waiting" if pending else "Queue is clear",
            "url": reverse("admin:schools_school_verification_queue"),
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
    entries = [
        ("School profile", school_url, None),
        ("Leads", reverse("admin:admissions_admissionenquiry_changelist"), None),
        ("Facilities", reverse("admin:schools_schoolfacility_changelist"), reverse("admin:schools_schoolfacility_add")),
        ("Grades", reverse("admin:schools_schoolgrade_changelist"), reverse("admin:schools_schoolgrade_add")),
        ("Fees", reverse("admin:fees_feestructure_changelist"), reverse("admin:fees_feestructure_add")),
    ]
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


def school_workspace(request):
    """Home for a school administrator: their profile and the leads they received."""
    from apps.admissions.models import AdmissionEnquiry
    from apps.schools.completeness import build_profile_completion
    from apps.schools.models import School

    school_id = assigned_school_id(request.user)
    if school_id is None:
        return redirect("admin:index")
    school = (
        School.objects.select_related("city", "state")
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
        "facilities_url": reverse("admin:schools_schoolfacility_changelist"),
        "grades_url": reverse("admin:schools_schoolgrade_changelist"),
        "fees_url": reverse("admin:fees_feestructure_changelist"),
    }
    return render(request, "admin/school_workspace.html", context)


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
