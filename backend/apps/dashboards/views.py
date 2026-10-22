"""Role dashboards.

Read-only JSON summaries powering the four front-end dashboards:
  /api/dashboards/school/       → SCHOOL_ADMIN (own school)
  /api/dashboards/parent/       → PARENT (own activity)
  /api/dashboards/admin/        → SUPER_ADMIN / STAFF_ADMIN (platform totals)
  /api/dashboards/staff-admin/  → STAFF_ADMIN / SUPER_ADMIN (moderation queues)
"""
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admissions.models import AdmissionEnquiry, Child, CounsellingRequest
from apps.reviews.models import Review
from apps.schools.models import School
from apps.users.models import ParentShortlist, User
from apps.users.permissions import IsStaffAdmin, IsVerifiedSchoolAdmin


def _month_start():
    now = timezone.now()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _status_counts(queryset, field, choices):
    rows = queryset.values(field).annotate(total=Count(field))
    lookup = {row[field]: row["total"] for row in rows}
    return {code: lookup.get(code, 0) for code, _label in choices}


def _enquiry_row(enquiry):
    return {
        "enquiry_id": str(enquiry.enquiry_id),
        "enquiry_code": enquiry.enquiry_code,
        "status": enquiry.status,
        "priority": enquiry.priority,
        "created_at": enquiry.created_at,
        "school_name": enquiry.school.school_name if enquiry.school_id else "",
        "parent_name": (
            enquiry.parent_profile.user.get_full_name().strip()
            if enquiry.parent_profile_id
            else enquiry.guest_full_name
        ),
        "parent_email": (
            enquiry.parent_profile.user.email
            if enquiry.parent_profile_id
            else enquiry.guest_email
        ),
        "parent_phone": (
            enquiry.parent_profile.user.phone
            if enquiry.parent_profile_id
            else enquiry.guest_phone
        ),
        "child_name": enquiry.guest_child_name,
        "message": enquiry.message,
    }


def _school_admin_school(user):
    if getattr(user, "role", None) != User.ROLE_SCHOOL_ADMIN:
        return None
    try:
        return user.school_admin_profile.school
    except ObjectDoesNotExist:
        return None


def _school_card(school):
    checks = [
        (school.tagline, "Add a one-line tagline"),
        (school.about, "Write an about section"),
        (school.phone, "Add a phone number"),
        (school.email, "Add an email address"),
        (school.website, "Add the school website"),
        (school.school_logo_url, "Add a logo"),
        (school.school_image_url, "Add a campus photo"),
        (school.principal_name, "Add the principal's name"),
        (school.established_year, "Add the year established"),
    ]
    gaps = [label for value, label in checks if not value]
    return {
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
        "profile_completeness": round((len(checks) - len(gaps)) / len(checks) * 100),
        "profile_gaps": gaps,
    }


def _shortlist_row(item):
    school = item.school
    return {
        "shortlist_id": str(item.shortlist_id),
        "note": item.note,
        "created_at": item.created_at,
        "school_id": str(school.school_id),
        "school_name": school.school_name,
        "slug": school.slug,
        "verification_status": school.verification_status,
        "city_name": school.city.city_name if school.city_id else "",
        "state_name": school.state.state_name if school.state_id else "",
        "country_slug": school.country.slug if school.country_id else "",
        "state_slug": school.state.slug if school.state_id else "",
        "city_slug": school.city.slug if school.city_id else "",
        "location_slug": school.location.slug if school.location_id else None,
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
    }


class SchoolDashboardView(APIView):
    """School administrators see a waiting screen until staff verify the school."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school_admin_school(request.user)
        if school is None:
            return Response(
                {"detail": "This dashboard is for school administrator accounts."},
                status=403,
            )

        if school.verification_status != "VERIFIED":
            return Response(
                {
                    "panel_access": "pending",
                    "school": _school_card(school),
                    "stats": {
                        "enquiries_total": 0,
                        "enquiries_new": 0,
                        "enquiries_this_month": 0,
                        "enquiries_converted": 0,
                        "reviews_published": 0,
                        "reviews_pending": 0,
                        "average_rating": None,
                    },
                    "enquiry_status": {},
                    "recent_enquiries": [],
                }
            )

        enquiries = AdmissionEnquiry.objects.filter(school=school)
        reviews = Review.objects.filter(school=school)

        return Response(
            {
                "panel_access": "admin",
                "school": _school_card(school),
                "stats": {
                    "enquiries_total": enquiries.count(),
                    "enquiries_new": enquiries.filter(status="NEW").count(),
                    "enquiries_this_month": enquiries.filter(
                        created_at__gte=_month_start()
                    ).count(),
                    "enquiries_converted": enquiries.filter(
                        status="CONVERTED"
                    ).count(),
                    "reviews_published": reviews.filter(
                        status=Review.STATUS_PUBLISHED
                    ).count(),
                    "reviews_pending": reviews.filter(
                        status=Review.STATUS_PENDING
                    ).count(),
                    "average_rating": reviews.filter(
                        status=Review.STATUS_PUBLISHED
                    ).aggregate(value=Avg("rating"))["value"],
                },
                "enquiry_status": _status_counts(
                    enquiries, "status", AdmissionEnquiry.STATUS_CHOICES
                ),
                "recent_enquiries": [
                    _enquiry_row(row)
                    for row in enquiries.select_related(
                        "school", "parent_profile__user"
                    ).order_by("-created_at")[:10]
                ],
            }
        )


class SchoolEnquiryStatusView(APIView):
    """Verified school admins move their own enquiries through the pipeline."""

    permission_classes = [IsVerifiedSchoolAdmin]

    def post(self, request, enquiry_id):
        status = request.data.get("status")
        allowed = {code for code, _label in AdmissionEnquiry.STATUS_CHOICES}
        if status not in allowed:
            return Response(
                {"detail": "Choose a valid enquiry status."},
                status=400,
            )
        school = request.user.school_admin_profile.school
        enquiry = (
            AdmissionEnquiry.objects.select_related("school", "parent_profile__user")
            .filter(enquiry_id=enquiry_id, school=school)
            .first()
        )
        if enquiry is None:
            return Response({"detail": "Enquiry not found."}, status=404)
        enquiry.status = status
        enquiry.save(update_fields=["status", "updated_at"])
        return Response(_enquiry_row(enquiry))


class ParentShortlistView(APIView):
    """Parents save or remove a school from the shortlist on their dashboard."""

    permission_classes = [IsAuthenticated]

    def _profile(self, request):
        if getattr(request.user, "role", None) != User.ROLE_PARENT:
            return None
        return getattr(request.user, "parent_profile", None)

    def get(self, request):
        profile = self._profile(request)
        if profile is None:
            return Response({"detail": "Shortlists are for parent accounts."}, status=403)
        school_id = request.query_params.get("school_id")
        saved = ParentShortlist.objects.filter(
            parent_profile=profile,
            school_id=school_id,
        ).exists()
        return Response({"saved": saved})

    def post(self, request):
        profile = self._profile(request)
        if profile is None:
            return Response({"detail": "Shortlists are for parent accounts."}, status=403)
        school = School.objects.filter(
            school_id=request.data.get("school_id"),
            status=True,
        ).first()
        if school is None:
            return Response({"detail": "School not found."}, status=404)
        item, created = ParentShortlist.objects.get_or_create(
            parent_profile=profile,
            school=school,
        )
        return Response(
            {"saved": True, "shortlist_id": str(item.shortlist_id)},
            status=201 if created else 200,
        )

    def delete(self, request):
        profile = self._profile(request)
        if profile is None:
            return Response({"detail": "Shortlists are for parent accounts."}, status=403)
        school_id = request.data.get("school_id") or request.query_params.get("school_id")
        ParentShortlist.objects.filter(
            parent_profile=profile,
            school_id=school_id,
        ).delete()
        return Response({"saved": False})


class ParentDashboardView(APIView):
    """A parent's own enquiries, children, reviews and counselling requests."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "parent_profile", None)
        if profile is None:
            return Response(
                {"detail": "This dashboard is for parent accounts."}, status=403
            )

        enquiries = AdmissionEnquiry.objects.filter(parent_profile=profile)
        reviews = Review.objects.filter(user=request.user)
        children = Child.objects.filter(parent_profile=profile)
        shortlist = ParentShortlist.objects.filter(parent_profile=profile).select_related(
            "school",
            "school__city",
            "school__state",
            "school__country",
            "school__location",
        ).prefetch_related("school__school_types")

        return Response(
            {
                "stats": {
                    "enquiries_total": enquiries.count(),
                    "enquiries_open": enquiries.exclude(
                        status__in=["CONVERTED", "CLOSED_LOST", "SPAM"]
                    ).count(),
                    "children": children.count(),
                    "reviews_total": reviews.count(),
                    "reviews_published": reviews.filter(
                        status=Review.STATUS_PUBLISHED
                    ).count(),
                    "shortlisted": shortlist.count(),
                },
                "shortlist": [_shortlist_row(item) for item in shortlist[:12]],
                "children": [
                    {
                        "child_id": str(child.child_id),
                        "name": child.name,
                        "date_of_birth": child.date_of_birth,
                        "gender": child.gender,
                    }
                    for child in children.order_by("name")
                ],
                "recent_enquiries": [
                    _enquiry_row(row)
                    for row in enquiries.select_related(
                        "school", "parent_profile__user"
                    ).order_by("-created_at")[:10]
                ],
            }
        )


class AdminDashboardView(APIView):
    """Platform-wide totals for super/staff admins."""

    permission_classes = [IsStaffAdmin]

    def get(self, request):
        schools = School.objects.all()
        enquiries = AdmissionEnquiry.objects.all()
        reviews = Review.objects.all()

        cities = set(schools.values_list("city__city_name", flat=True).distinct())

        return Response(
            {
                "schools": {
                    "total": schools.count(),
                    "listed": schools.filter(status=True).count(),
                    "pending_verification": schools.filter(
                        verification_status="PENDING"
                    ).count(),
                    "verified": schools.filter(
                        verification_status="VERIFIED"
                    ).count(),
                    "added_this_month": schools.filter(
                        created_at__gte=_month_start()
                    ).count(),
                },
                "users": {
                    "total": User.objects.count(),
                    "parents": User.objects.filter(role=User.ROLE_PARENT).count(),
                    "school_admins": User.objects.filter(
                        role=User.ROLE_SCHOOL_ADMIN
                    ).count(),
                    "staff_admins": User.objects.filter(
                        role=User.ROLE_STAFF_ADMIN
                    ).count(),
                    "super_admins": User.objects.filter(
                        role=User.ROLE_SUPER_ADMIN
                    ).count(),
                    "new_this_month": User.objects.filter(
                        date_joined__gte=_month_start()
                    ).count(),
                },
                "enquiries": {
                    "total": enquiries.count(),
                    "this_month": enquiries.filter(
                        created_at__gte=_month_start()
                    ).count(),
                    "by_status": _status_counts(
                        enquiries, "status", AdmissionEnquiry.STATUS_CHOICES
                    ),
                },
                "reviews": {
                    "total": reviews.count(),
                    "by_status": _status_counts(
                        reviews, "status", Review.STATUS_CHOICES
                    ),
                },
                "counselling": {
                    "total": CounsellingRequest.objects.count(),
                    "new": CounsellingRequest.objects.filter(status="NEW").count(),
                },
                "coverage": {"cities_covered": len(cities)},
                "pending_schools": [
                    {
                        "school_id": str(school.school_id),
                        "school_name": school.school_name,
                        "school_code": school.school_code,
                        "city_name": school.city.city_name,
                        "state_name": school.state.state_name,
                        "created_at": school.created_at,
                    }
                    for school in schools.filter(verification_status="PENDING")
                    .select_related("city", "state")
                    .order_by("created_at")[:10]
                ],
                "recent_enquiries": [
                    _enquiry_row(row)
                    for row in enquiries.select_related(
                        "school", "parent_profile__user"
                    ).order_by("-created_at")[:10]
                ],
            }
        )


class StaffAdminDashboardView(APIView):
    """Moderation and CRM queues for staff/admin operators."""

    permission_classes = [IsStaffAdmin]

    def get(self, request):
        reviews = Review.objects.all()
        enquiries = AdmissionEnquiry.objects.all()
        counselling = CounsellingRequest.objects.all()

        return Response(
            {
                "queues": {
                    "reviews_pending": reviews.filter(
                        status=Review.STATUS_PENDING
                    ).count(),
                    "schools_pending": School.objects.filter(
                        verification_status="PENDING"
                    ).count(),
                    "enquiries_new": enquiries.filter(status="NEW").count(),
                    "enquiries_unassigned": enquiries.filter(
                        Q(assigned_to__isnull=True) & Q(status="NEW")
                    ).count(),
                    "counselling_new": counselling.filter(status="NEW").count(),
                },
                "workload": {
                    "enquiries_this_month": enquiries.filter(
                        created_at__gte=_month_start()
                    ).count(),
                    "reviews_this_month": reviews.filter(
                        created_at__gte=_month_start()
                    ).count(),
                    "counselling_this_month": counselling.filter(
                        created_at__gte=_month_start()
                    ).count(),
                },
                "recent_reviews": [
                    {
                        "review_id": str(review.review_id),
                        "school_name": review.school.school_name,
                        "rating": review.rating,
                        "status": review.status,
                        "author_name": review.author_name,
                        "title": review.title,
                        "created_at": review.created_at,
                    }
                    for review in reviews.select_related("school").order_by(
                        "-created_at"
                    )[:10]
                ],
                "recent_enquiries": [
                    _enquiry_row(row)
                    for row in enquiries.select_related(
                        "school", "parent_profile__user"
                    ).order_by("-created_at")[:10]
                ],
                "pending_schools": [
                    {
                        "school_id": str(school.school_id),
                        "school_name": school.school_name,
                        "school_code": school.school_code,
                        "city_name": school.city.city_name,
                        "state_name": school.state.state_name,
                        "created_at": school.created_at,
                    }
                    for school in School.objects.filter(
                        verification_status="PENDING"
                    )
                    .select_related("city", "state")
                    .order_by("created_at")[:10]
                ],
            }
        )
