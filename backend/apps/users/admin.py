from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, ParentProfile, SchoolAdminProfile, StaffAdminProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "role", "is_active", "is_staff", "date_joined")
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    search_fields = ("username", "email", "phone")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Enterprise Role & Profile", {"fields": ("role", "phone")}),
        ("Email verification", {"fields": ("is_email_verified", "email_verified_at")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Role (IMPORTANT)", {"fields": ("role", "phone")}),
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "last_login",
        "is_email_verified",
        "email_verified_at",
    )

    def save_model(self, request, obj, form, change):
        if change:
            original_email = User.objects.values_list("email", flat=True).get(pk=obj.pk)
            if original_email.strip().lower() != obj.email.strip().lower():
                obj.is_email_verified = False
                obj.email_verified_at = None
        super().save_model(request, obj, form, change)


@admin.register(ParentProfile)
class ParentProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "preferred_contact_method", "occupation", "created_at")
    search_fields = ("user__username", "user__email")
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(SchoolAdminProfile)
class SchoolAdminProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "school", "designation", "created_at")
    list_filter = ("school__school_types", "school__boards")
    search_fields = ("user__username", "school__school_name", "designation")
    autocomplete_fields = ("user", "school")
    readonly_fields = ("created_at", "updated_at")


@admin.register(StaffAdminProfile)
class StaffAdminProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "designation", "department", "created_at")
    search_fields = ("user__username", "designation", "department")
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")
