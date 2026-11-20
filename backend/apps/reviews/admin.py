from django.contrib import admin, messages
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from django.utils import timezone

from apps.users.models import User
from .models import Review


def _assigned_school_id(user):
    if user.role != User.ROLE_SCHOOL_ADMIN:
        return None
    try:
        return user.school_admin_profile.school_id
    except ObjectDoesNotExist:
        return None


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        "school",
        "rating",
        "author_name",
        "status",
        "is_verified",
        "moderated_by",
        "moderated_at",
        "created_at",
    )
    list_filter = ("status", "is_verified", "rating")
    search_fields = (
        "title",
        "body",
        "author_name",
        "school__school_name",
        "user__username",
        "user__email",
    )
    autocomplete_fields = ("school", "user")
    date_hierarchy = "created_at"
    readonly_fields = (
        "review_id",
        "school",
        "user",
        "author_name",
        "rating",
        "academics_rating",
        "facilities_rating",
        "safety_rating",
        "communication_rating",
        "title",
        "body",
        "status",
        "is_verified",
        "moderated_by",
        "moderated_at",
        "created_at",
        "updated_at",
    )
    actions = ("approve_reviews", "reject_reviews")

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.role == User.ROLE_SCHOOL_ADMIN:
            school_id = _assigned_school_id(request.user)
            if school_id is None:
                return queryset.none()
            return queryset.filter(school_id=school_id)
        return queryset

    def has_module_permission(self, request):
        if request.user.role == User.ROLE_SCHOOL_ADMIN:
            return _assigned_school_id(request.user) is not None
        return bool(
            request.user.is_superuser
            or request.user.role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN)
        )

    def has_view_permission(self, request, obj=None):
        if request.user.role == User.ROLE_SCHOOL_ADMIN:
            school_id = _assigned_school_id(request.user)
            return school_id is not None and (obj is None or obj.school_id == school_id)
        return bool(
            request.user.is_superuser
            or request.user.role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN)
        )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        if request.user.role == User.ROLE_SCHOOL_ADMIN:
            return False
        return bool(
            request.user.is_superuser
            or request.user.role == User.ROLE_SUPER_ADMIN
        )

    def has_delete_permission(self, request, obj=None):
        return False

    def get_actions(self, request):
        if request.user.role == User.ROLE_SCHOOL_ADMIN:
            return {}
        actions = super().get_actions(request)
        if request.user.role != User.ROLE_SUPER_ADMIN and not request.user.is_superuser:
            actions.pop("approve_reviews", None)
            actions.pop("reject_reviews", None)
        return actions

    @admin.action(description="Approve selected pending reviews")
    def approve_reviews(self, request, queryset):
        if request.user.role != User.ROLE_SUPER_ADMIN and not request.user.is_superuser:
            raise PermissionDenied
        updated = queryset.filter(status=Review.STATUS_PENDING).update(
            status=Review.STATUS_APPROVED,
            moderated_by=request.user,
            moderated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} review(s) approved.")

    @admin.action(description="Reject selected reviews")
    def reject_reviews(self, request, queryset):
        if request.user.role != User.ROLE_SUPER_ADMIN and not request.user.is_superuser:
            raise PermissionDenied
        updated = queryset.filter(status=Review.STATUS_PENDING).update(
            status=Review.STATUS_REJECTED,
            moderated_by=request.user,
            moderated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} review(s) rejected.")
