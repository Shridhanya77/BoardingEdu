"""Limit Django admin to the school assigned to a school administrator.

Platform staff and superusers keep the normal admin. A school administrator
can sign in at /admin/ without being a platform staff account, and every
queryset is restricted to their school.
"""
from django import forms
from django.contrib.admin.forms import AdminAuthenticationForm
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm
from django.core.exceptions import ObjectDoesNotExist
from django.utils.translation import gettext_lazy as _

from apps.users.models import User


def assigned_school_id(user):
    if not getattr(user, "is_authenticated", False):
        return None
    if getattr(user, "is_superuser", False):
        return None
    if getattr(user, "role", None) != User.ROLE_SCHOOL_ADMIN:
        return None
    try:
        return user.school_admin_profile.school_id
    except ObjectDoesNotExist:
        return None


def manages_own_school(user):
    return assigned_school_id(user) is not None


class BoardingEduAdminAuthenticationForm(AdminAuthenticationForm):
    """Accept staff accounts and a school administrator assigned to one school.

    Django's own admin form rejects every non-staff user even when the
    password is correct. This form also accepts the email stored on the
    account, which is how the website login works.
    """

    error_messages = {
        **AdminAuthenticationForm.error_messages,
        "invalid_login": _(
            "Please enter the correct %(username)s and password. "
            "The email address on the account also works. Both fields may be case-sensitive."
        ),
    }

    def clean(self):
        username = self.cleaned_data.get("username")
        if username and "@" in username:
            matches = list(
                get_user_model().objects.filter(email__iexact=username).order_by("pk")[:2]
            )
            if len(matches) == 1:
                self.cleaned_data["username"] = matches[0].get_username()
        return super().clean()

    def confirm_login_allowed(self, user):
        AuthenticationForm.confirm_login_allowed(self, user)
        if (
            user.role == User.ROLE_SCHOOL_ADMIN
            and not user.is_email_verified
        ):
            raise forms.ValidationError(
                "Email verification is required before signing in.",
                code="email_not_verified",
            )
        if user.is_staff or user.is_superuser or assigned_school_id(user) is not None:
            return
        raise forms.ValidationError(
            self.error_messages["invalid_login"],
            code="invalid_login",
            params={"username": self.username_field.verbose_name},
        )


class AssignedSchoolAdminMixin:
    """Filter an admin to one school. Set school_filter to the lookup path."""

    school_filter = "school_id"
    school_admin_can_add = True
    school_admin_can_delete = True

    def has_module_permission(self, request):
        if manages_own_school(request.user):
            return True
        return super().has_module_permission(request)

    def has_view_permission(self, request, obj=None):
        if manages_own_school(request.user):
            return obj is None or self._owns(request, obj)
        return super().has_view_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        if manages_own_school(request.user):
            return obj is None or self._owns(request, obj)
        return super().has_change_permission(request, obj)

    def has_add_permission(self, request):
        if manages_own_school(request.user):
            return self.school_admin_can_add
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        if manages_own_school(request.user):
            return self.school_admin_can_delete and (obj is None or self._owns(request, obj))
        return super().has_delete_permission(request, obj)

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        school_id = assigned_school_id(request.user)
        if school_id is None:
            return queryset
        return queryset.filter(**{self.school_filter: school_id})

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        school_id = assigned_school_id(request.user)
        if school_id is not None:
            if db_field.name == "school":
                from apps.schools.models import School

                kwargs["queryset"] = School.objects.filter(pk=school_id)
            elif db_field.name == "fee_structure":
                from apps.fees.models import FeeStructure

                kwargs["queryset"] = FeeStructure.objects.filter(school_id=school_id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        school_id = assigned_school_id(request.user)
        if school_id is not None and hasattr(obj, "school_id") and self.school_filter == "school_id":
            obj.school_id = school_id
        super().save_model(request, obj, form, change)

    def _owns(self, request, obj):
        school_id = assigned_school_id(request.user)
        if school_id is None:
            return False
        if self.school_filter == "pk":
            return obj.pk == school_id
        if self.school_filter == "school_id":
            return getattr(obj, "school_id", None) == school_id
        if self.school_filter == "fee_structure__school_id":
            return getattr(getattr(obj, "fee_structure", None), "school_id", None) == school_id
        return False


class CatalogVisibleToSchoolAdminMixin:
    """Let a school admin search reference data without editing the master lists."""

    def has_view_permission(self, request, obj=None):
        if manages_own_school(request.user):
            return True
        return super().has_view_permission(request, obj)
