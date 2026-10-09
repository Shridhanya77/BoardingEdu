from django.contrib import admin
from .models import Child, AdmissionEnquiry


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ("name", "parent_profile", "date_of_birth", "gender", "current_grade")
    list_filter = ("gender", "current_grade")
    search_fields = ("name", "parent_profile__user__username", "parent_profile__user__email")
    autocomplete_fields = ("parent_profile", "current_grade")
    readonly_fields = ("created_at", "updated_at")


@admin.register(AdmissionEnquiry)
class AdmissionEnquiryAdmin(admin.ModelAdmin):
    list_display = (
        "enquiry_code",
        "school",
        "status",
        "priority",
        "assigned_to",
        "next_followup_at",
    )
    list_filter = ("status", "priority", "source", "school")
    search_fields = ("enquiry_code", "message", "parent_profile__user__username")
    autocomplete_fields = (
        "parent_profile",
        "child",
        "school",
        "academic_year",
        "applying_for_grade",
        "assigned_to",
    )
    date_hierarchy = "created_at"
    readonly_fields = ("enquiry_id", "created_at", "updated_at")
    fieldsets = (
        (
            "Enquiry Identity",
            {
                "fields": ("enquiry_id", "enquiry_code", "source", "message"),
            },
        ),
        (
            "Relations",
            {
                "fields": (
                    "parent_profile",
                    "child",
                    "school",
                    "academic_year",
                    "applying_for_grade",
                ),
            },
        ),
        (
            "CRM Workflow",
            {
                "fields": (
                    "status",
                    "priority",
                    "assigned_to",
                    "next_followup_at",
                    "closed_at",
                ),
            },
        ),
        (
            "Audit",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )
