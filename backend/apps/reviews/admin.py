from django.contrib import admin, messages
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from django.http import HttpResponseNotAllowed
from django.shortcuts import get_object_or_404, redirect
from django.utils import timezone
from django.urls import path, reverse

from apps.users.models import User
from .models import Review


def _assigned_school_id(user):
    if getattr(user, "role", None) != User.ROLE_SCHOOL_ADMIN:
        return None
    try:
        return user.school_admin_profile.school_id
    except ObjectDoesNotExist:
        return None


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    change_form_template = "admin/reviews/review/change_form.html"
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

    def get_urls(self):
        opts = self.model._meta
        custom_urls = [
            path(
                "<path:object_id>/approve/",
                self.admin_site.admin_view(self.approve_view),
                name=f"{opts.app_label}_{opts.model_name}_approve",
            ),
            path(
                "<path:object_id>/reject/",
                self.admin_site.admin_view(self.reject_view),
                name=f"{opts.app_label}_{opts.model_name}_reject",
            ),
        ]
        return custom_urls + super().get_urls()

    def can_moderate(self, user):
        role = getattr(user, "role", None)
        return role == User.ROLE_SUPER_ADMIN or (
            role != User.ROLE_SCHOOL_ADMIN
            and getattr(user, "is_superuser", False)
        )

    def render_change_form(self, request, context, *args, **kwargs):
        context["can_moderate_reviews"] = self.can_moderate(request.user)
        return super().render_change_form(request, context, *args, **kwargs)

    def _moderate_queryset(self, queryset, user, decision):
        decided_at = timezone.now()
        return queryset.filter(status=Review.STATUS_PENDING).update(
            status=decision,
            moderated_by=user,
            moderated_at=decided_at,
            updated_at=decided_at,
        )

    def _moderate_view(self, request, object_id, decision):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])
        if not self.can_moderate(request.user):
            raise PermissionDenied
        review = get_object_or_404(self.get_queryset(request), pk=object_id)
        updated = self._moderate_queryset(
            self.get_queryset(request).filter(pk=review.pk),
            request.user,
            decision,
        )
        if updated:
            self.message_user(
                request,
                "Review accepted." if decision == Review.STATUS_APPROVED else "Review rejected.",
                messages.SUCCESS,
            )
        else:
            self.message_user(
                request,
                "Only pending reviews can be moderated.",
                messages.WARNING,
            )
        return redirect(
            reverse(
                f"admin:{self.model._meta.app_label}_{self.model._meta.model_name}_change",
                args=[review.pk],
            )
        )

    def approve_view(self, request, object_id):
        return self._moderate_view(request, object_id, Review.STATUS_APPROVED)

    def reject_view(self, request, object_id):
        return self._moderate_view(request, object_id, Review.STATUS_REJECTED)

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.role == User.ROLE_SCHOOL_ADMIN:
            school_id = _assigned_school_id(request.user)
            if school_id is None:
                return queryset.none()
            return queryset.filter(school_id=school_id)
        return queryset

    def has_module_permission(self, request):
        role = getattr(request.user, "role", None)
        if role == User.ROLE_SCHOOL_ADMIN:
            return _assigned_school_id(request.user) is not None
        return bool(
            getattr(request.user, "is_superuser", False)
            or role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN)
        )

    def has_view_permission(self, request, obj=None):
        role = getattr(request.user, "role", None)
        if role == User.ROLE_SCHOOL_ADMIN:
            school_id = _assigned_school_id(request.user)
            return school_id is not None and (obj is None or obj.school_id == school_id)
        return bool(
            getattr(request.user, "is_superuser", False)
            or role in (User.ROLE_SUPER_ADMIN, User.ROLE_STAFF_ADMIN)
        )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        role = getattr(request.user, "role", None)
        if role == User.ROLE_SCHOOL_ADMIN:
            return False
        return bool(
            getattr(request.user, "is_superuser", False)
            or role == User.ROLE_SUPER_ADMIN
        )

    def has_delete_permission(self, request, obj=None):
        return False

    def get_actions(self, request):
        role = getattr(request.user, "role", None)
        if role == User.ROLE_SCHOOL_ADMIN:
            return {}
        actions = super().get_actions(request)
        if role != User.ROLE_SUPER_ADMIN and not getattr(
            request.user, "is_superuser", False
        ):
            actions.pop("approve_reviews", None)
            actions.pop("reject_reviews", None)
        return actions

    @admin.action(description="Approve selected pending reviews")
    def approve_reviews(self, request, queryset):
        if not self.can_moderate(request.user):
            raise PermissionDenied
        updated = self._moderate_queryset(queryset, request.user, Review.STATUS_APPROVED)
        self.message_user(request, f"{updated} review(s) approved.")

    @admin.action(description="Reject selected reviews")
    def reject_reviews(self, request, queryset):
        if not self.can_moderate(request.user):
            raise PermissionDenied
        updated = self._moderate_queryset(queryset, request.user, Review.STATUS_REJECTED)
        self.message_user(request, f"{updated} review(s) rejected.")
