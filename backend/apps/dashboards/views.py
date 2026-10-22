"""Role dashboards.

Read-only JSON summaries powering the four front-end dashboards:
  /api/dashboards/school/       → SCHOOL_ADMIN (own school)
  /api/dashboards/parent/       → PARENT (own activity)
  /api/dashboards/admin/        → SUPER_ADMIN / STAFF_ADMIN (platform totals)
  /api/dashboards/staff-admin/  → STAFF_ADMIN / SUPER_ADMIN (moderation queues)
"""
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admissions.models import AdmissionEnquiry, Child, CounsellingRequest
from apps.reviews.models import Review
from apps.schools.models import School
from apps.users.models import User
from apps.users.permissions import IsStaffAdmin


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


class SchoolDashboardView(APIView):
    """Everything a verified school administrator needs on one screen."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "school_admin_profile", None)
        if request.user.role != User.SCHOOL_ADMIN or profile is None:
            return Response(
                {"detail": "This dashboard is for school administrators."},
                status=403,
            )

        school = profile.school
        enquiries = AdmissionEnquiry.objects.filter(school=school)
        reviews = Review.objects.filter(school=school)

        profile_fields = [
            school.school_image_url,
            school.school_logo_url,
            school.address,
            school.phone,
            school.email,
            school.pincode,
            school.established_year,
        ]
        completeness = round(
            sum(1 for value in profile_fields if value) / len(profile_fields) * 100
        )

        return Response(
            {
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
                    "profile_completeness": completeness,
                },
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
                },
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
