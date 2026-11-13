"""Role dashboards.

Read-only JSON summaries powering the four front-end dashboards:
  /api/dashboards/school/       → SCHOOL_ADMIN (own school)
  /api/dashboards/parent/       → PARENT (own activity)
  /api/dashboards/admin/        → SUPER_ADMIN / STAFF_ADMIN (platform totals)
  /api/dashboards/staff-admin/  → STAFF_ADMIN / SUPER_ADMIN (moderation queues)
"""
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admissions.models import AdmissionEnquiry, Child, CounsellingRequest
from apps.reviews.models import Review
from apps.schools.models import School
from apps.schools.querysets import public_school_queryset
from apps.users.models import ParentShortlist, User
from apps.users.permissions import IsStaffAdmin, IsVerifiedSchoolAdmin
from .models import RecentSchoolView
from .school_ops import build_school_admin_payload


def _month_start():
    now = timezone.now()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _month_starts(count=6):
    current = timezone.localdate().replace(day=1)
    starts = []
    for offset in range(count - 1, -1, -1):
        month_index = current.year * 12 + current.month - 1 - offset
        year, month = divmod(month_index, 12)
        starts.append(current.replace(year=year, month=month + 1))
    return starts


def _monthly_activity(enquiries, reviews, months=6):
    starts = _month_starts(months)
    start_date = starts[0]
    next_month_index = starts[-1].year * 12 + starts[-1].month
    next_month_year, next_month = divmod(next_month_index, 12)
    end_date = starts[-1].replace(year=next_month_year, month=next_month + 1)
    enquiry_counts = {
        row["month"].date().replace(day=1): row["total"]
        for row in enquiries.filter(
            created_at__date__gte=start_date,
            created_at__date__lt=end_date,
        )
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Count("pk"))
    }
    review_counts = {
        row["month"].date().replace(day=1): row["total"]
        for row in reviews.filter(
            created_at__date__gte=start_date,
            created_at__date__lt=end_date,
        )
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Count("pk"))
    }
    return [
        {
            "month": month.isoformat(),
            "enquiries": enquiry_counts.get(month, 0),
            "reviews": review_counts.get(month, 0),
        }
        for month in starts
    ]


def _status_counts(queryset, field, choices):
    rows = queryset.values(field).annotate(total=Count(field))
    lookup = {row[field]: row["total"] for row in rows}
    return {code: lookup.get(code, 0) for code, _label in choices}


def _enquiry_row(enquiry, include_contacts=True):
    child_name = ""
    if enquiry.child_id:
        try:
            child_name = enquiry.child.name
        except Exception:
            child_name = ""
    if not child_name:
        child_name = enquiry.guest_child_name
    parent_name = ""
    parent_email = ""
    parent_phone = ""
    if enquiry.parent_profile_id:
        try:
            user = enquiry.parent_profile.user
            parent_name = user.get_full_name().strip() or user.username
            parent_email = user.email
            parent_phone = user.phone
        except Exception:
            parent_name = ""
    else:
        parent_name = enquiry.guest_full_name
        parent_email = enquiry.guest_email
        parent_phone = enquiry.guest_phone
    row = {
        "enquiry_id": str(enquiry.enquiry_id),
        "enquiry_code": enquiry.enquiry_code,
        "status": enquiry.status,
        "priority": enquiry.priority,
        "created_at": enquiry.created_at,
        "school_name": enquiry.school.school_name if enquiry.school_id else "",
        "source": enquiry.source,
        "grade_name": enquiry.applying_for_grade.grade_name if enquiry.applying_for_grade_id else "",
        "academic_year": enquiry.academic_year.year_code if enquiry.academic_year_id else "",
        "contacts_locked": not include_contacts,
        "parent_name": parent_name if include_contacts else "",
        "parent_email": parent_email if include_contacts else "",
        "parent_phone": parent_phone if include_contacts else "",
        "child_name": child_name if include_contacts else "",
        "message": enquiry.message if include_contacts else "",
        "application_status": getattr(enquiry, "application_status", "SUBMITTED"),
        "updated_at": enquiry.updated_at,
    }
    return row


def _school_admin_school(user):
    if getattr(user, "role", None) != User.ROLE_SCHOOL_ADMIN:
        return None
    try:
        return user.school_admin_profile.school
    except ObjectDoesNotExist:
        return None


def _school_summary_row(school):
    return {
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


def _shortlist_row(item):
    return {
        "shortlist_id": str(item.shortlist_id),
        "note": item.note,
        "created_at": item.created_at,
        **_school_summary_row(item.school),
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

        try:
            activity_months = int(request.query_params.get("months", 6))
        except (TypeError, ValueError):
            return Response({"detail": "months must be 3, 6, or 12."}, status=400)
        if activity_months not in {3, 6, 12}:
            return Response({"detail": "months must be 3, 6, or 12."}, status=400)

        enquiries = AdmissionEnquiry.objects.filter(school=school)
        reviews = Review.objects.filter(school=school)
        from apps.subscriptions.access import subscription_summary, viewer_can_see_contacts

        verified = school.verification_status == "VERIFIED"

        def enquiry_rows():
            rows = enquiries.select_related(
                "school", "parent_profile__user", "child", "applying_for_grade", "academic_year"
            ).order_by("-created_at")[:100]
            return [
                _enquiry_row(row, include_contacts=viewer_can_see_contacts(request.user, row))
                for row in rows
            ]

        payload = build_school_admin_payload(
            request.user,
            enquiry_rows,
        )
        if payload is None:
            return Response(
                {"detail": "This dashboard is for school administrator accounts."},
                status=403,
            )
        payload["stats"] = {
            "enquiries_total": enquiries.count(),
            "enquiries_new": enquiries.filter(status="NEW").count(),
            "enquiries_this_month": enquiries.filter(created_at__gte=_month_start()).count(),
            "enquiries_converted": enquiries.filter(status="CONVERTED").count(),
            "reviews_published": reviews.filter(status=Review.STATUS_PUBLISHED).count(),
            "reviews_pending": reviews.filter(status=Review.STATUS_PENDING).count(),
            "average_rating": reviews.filter(status=Review.STATUS_PUBLISHED).aggregate(
                value=Avg("rating")
            )["value"],
        }
        payload["reviews"] = [
            {
                "review_id": str(review.review_id),
                "author_name": review.display_name,
                "rating": review.rating,
                "title": review.title,
                "body": review.body[:1200],
                "status": review.status,
                "is_verified": review.is_verified,
                "created_at": review.created_at.isoformat(),
            }
            for review in reviews.select_related("user").order_by("-created_at")[:100]
        ]
        payload["enquiry_status"] = _status_counts(
            enquiries, "status", AdmissionEnquiry.STATUS_CHOICES
        )
        payload["monthly_activity"] = _monthly_activity(
            enquiries,
            reviews,
            months=activity_months,
        )
        payload["subscription"] = subscription_summary(school)
        return Response(payload)


class SchoolEnquiryStatusView(APIView):
    """Verified school admins move their own enquiries through the pipeline."""

    permission_classes = [IsVerifiedSchoolAdmin]

    def post(self, request, enquiry_id):
        crm_status = request.data.get("status")
        application_status = request.data.get("application_status")
        allowed = {code for code, _label in AdmissionEnquiry.STATUS_CHOICES}
        application_choices = {code for code, _label in AdmissionEnquiry.APPLICATION_STATUS_CHOICES}
        if crm_status is None and application_status is None:
            return Response({"detail": "Choose a status to update."}, status=400)
        if crm_status is not None and crm_status not in allowed:
            return Response({"detail": "Choose a valid enquiry status."}, status=400)
        if application_status is not None and application_status not in application_choices:
            return Response({"detail": "Choose a valid application status."}, status=400)
        school = request.user.school_admin_profile.school
        enquiry = (
            AdmissionEnquiry.objects.select_related("school", "parent_profile__user")
            .filter(enquiry_id=enquiry_id, school=school)
            .first()
        )
        if enquiry is None:
            return Response({"detail": "Enquiry not found."}, status=404)
        if crm_status is not None:
            enquiry.status = crm_status
        if application_status is not None:
            enquiry.application_status = application_status
        enquiry._status_remarks = str(request.data.get("remarks") or "")[:1000]
        enquiry._status_instructions = str(request.data.get("instructions") or "")[:1000]
        enquiry.save()
        from apps.subscriptions.access import viewer_can_see_contacts

        return Response(
            _enquiry_row(enquiry, include_contacts=viewer_can_see_contacts(request.user, enquiry))
        )


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


class PublicPlatformSummaryView(APIView):
    permission_classes = []

    def get(self, request):
        schools = public_school_queryset()
        return Response(
            {
                "schools_listed": schools.count(),
                "cities_covered": schools.values("city_id").distinct().count(),
                "published_reviews": Review.objects.filter(
                    school__in=schools,
                    status=Review.STATUS_PUBLISHED,
                    is_verified=True,
                    user__role=User.ROLE_PARENT,
                ).count(),
                "last_updated": max(
                    filter(
                        None,
                        [
                            schools.order_by("-updated_at").values_list("updated_at", flat=True).first(),
                            Review.objects.filter(
                                school__in=schools,
                                status=Review.STATUS_PUBLISHED,
                                is_verified=True,
                                user__role=User.ROLE_PARENT,
                            ).order_by("-updated_at").values_list("updated_at", flat=True).first(),
                        ],
                    ),
                    default=None,
                ),
            }
        )


class ParentRecentSchoolView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "parent_profile", None)
        if getattr(request.user, "role", None) != User.ROLE_PARENT or profile is None:
            return Response(
                {"detail": "Recently viewed schools are available to parent accounts."},
                status=403,
            )

        school = public_school_queryset().filter(
            school_id=request.data.get("school_id")
        ).first()
        if school is None:
            return Response({"detail": "School not found."}, status=404)

        RecentSchoolView.objects.update_or_create(
            parent_profile=profile,
            school=school,
            defaults={"last_viewed_at": timezone.now()},
        )
        older_views = RecentSchoolView.objects.filter(
            parent_profile=profile,
        ).order_by("-last_viewed_at").values_list("pk", flat=True)[20:]
        if older_views:
            RecentSchoolView.objects.filter(pk__in=older_views).delete()
        return Response({"recorded": True}, status=200)

    def get(self, request):
        profile = getattr(request.user, "parent_profile", None)
        if getattr(request.user, "role", None) != User.ROLE_PARENT or profile is None:
            return Response(
                {"detail": "Recently viewed schools are available to parent accounts."},
                status=403,
            )
        views = RecentSchoolView.objects.filter(
            parent_profile=profile,
            school__in=public_school_queryset(),
        ).select_related(
            "school",
            "school__city",
            "school__state",
            "school__country",
            "school__location",
        ).prefetch_related("school__school_types")[:20]
        return Response([
            {
                "recent_view_id": str(item.recent_view_id),
                **_school_summary_row(item.school),
                "viewed_at": item.last_viewed_at,
            }
            for item in views
        ])

    def delete(self, request):
        profile = getattr(request.user, "parent_profile", None)
        if getattr(request.user, "role", None) != User.ROLE_PARENT or profile is None:
            return Response(
                {"detail": "Recently viewed schools are available to parent accounts."},
                status=403,
            )
        RecentSchoolView.objects.filter(parent_profile=profile).delete()
        return Response({"cleared": True})


class ParentRecentSchoolItemView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, recent_view_id):
        profile = getattr(request.user, "parent_profile", None)
        if getattr(request.user, "role", None) != User.ROLE_PARENT or profile is None:
            return Response(
                {"detail": "Recently viewed schools are available to parent accounts."},
                status=403,
            )
        deleted, _details = RecentSchoolView.objects.filter(
            recent_view_id=recent_view_id,
            parent_profile=profile,
        ).delete()
        if not deleted:
            return Response({"detail": "Recently viewed school not found."}, status=404)
        return Response({"removed": True})


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
        from apps.notifications.models import ParentNotification

        notifications = ParentNotification.objects.filter(user=request.user)
        reviews = Review.objects.filter(user=request.user)
        children = Child.objects.filter(parent_profile=profile)
        shortlist = ParentShortlist.objects.filter(parent_profile=profile).select_related(
            "school",
            "school__city",
            "school__state",
            "school__country",
            "school__location",
        ).prefetch_related("school__school_types")
        recent_views = RecentSchoolView.objects.filter(
            parent_profile=profile,
            school__in=public_school_queryset(),
        ).select_related(
            "school",
            "school__city",
            "school__state",
            "school__country",
            "school__location",
        ).prefetch_related("school__school_types")[:20]

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
                    "applications_total": enquiries.count(),
                    "applications_under_review": enquiries.filter(application_status="UNDER_REVIEW").count(),
                    "applications_in_progress": enquiries.filter(
                        application_status__in=[
                            "RECEIVED",
                            "INTERACTION_SCHEDULED",
                            "INTERACTION_COMPLETED",
                            "OFFERED",
                        ]
                    ).count(),
                    "applications_accepted": enquiries.filter(application_status="ACCEPTED").count(),
                    "applications_rejected": enquiries.filter(application_status="REJECTED").count(),
                    "applications_action_required": enquiries.filter(
                        application_status="DOCUMENTS_REQUIRED"
                    ).count(),
                    "notifications_unread": notifications.filter(read_at__isnull=True).count(),
                },
                "notifications": [
                    {
                        "notification_id": str(note.notification_id),
                        "title": note.title,
                        "body": note.body,
                        "enquiry_id": str(note.enquiry_id) if note.enquiry_id else None,
                        "read": note.read_at is not None,
                        "created_at": note.created_at,
                    }
                    for note in notifications[:8]
                ],
                "shortlist": [_shortlist_row(item) for item in shortlist[:12]],
                "recently_viewed_schools": [
                    {
                        "recent_view_id": str(item.recent_view_id),
                        **_school_summary_row(item.school),
                        "viewed_at": item.last_viewed_at,
                    }
                    for item in recent_views
                ],
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


def _blank(field):
    return Q(**{field: ""}) | Q(**{f"{field}__isnull": True})


def _school_data_quality(schools):
    return {
        "missing_logo": schools.filter(_blank("school_logo_url")).count(),
        "missing_cover": schools.filter(_blank("school_image_url")).count(),
        "missing_about": schools.filter(_blank("about")).count(),
        "missing_contact": schools.filter(_blank("phone"), _blank("email")).count(),
        "missing_locality": schools.filter(location__isnull=True).count(),
        "missing_board": schools.annotate(board_count=Count("boards", distinct=True))
        .filter(board_count=0)
        .count(),
        "missing_published_fees": schools.exclude(
            fee_structures__published=True,
            fee_structures__status=True,
        ).count(),
        "unverified": schools.filter(verification_status="UNVERIFIED").count(),
    }


class AdminDashboardView(APIView):
    """Platform-wide totals for super/staff admins."""

    permission_classes = [IsStaffAdmin]

    def get(self, request):
        schools = School.objects.all()
        public_schools = public_school_queryset()
        enquiries = AdmissionEnquiry.objects.all()
        reviews = Review.objects.all()

        cities = set(public_schools.values_list("city_id", flat=True).distinct())

        return Response(
            {
                "schools": {
                    "total": schools.count(),
                    "listed": public_schools.count(),
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
                "school_types": [
                    {"type_name": row["school_types__type_name"], "total": row["total"]}
                    for row in School.objects.values("school_types__type_name")
                    .annotate(total=Count("pk", distinct=True))
                    .order_by("school_types__type_name")
                    if row["school_types__type_name"]
                ],
                "data_quality": _school_data_quality(schools),
                "recent_schools": [
                    {
                        "school_id": str(school.school_id),
                        "school_name": school.school_name,
                        "school_code": school.school_code,
                        "city_name": school.city.city_name,
                        "verification_status": school.verification_status,
                        "updated_at": school.updated_at,
                    }
                    for school in schools.select_related("city").order_by("-updated_at")[:8]
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
