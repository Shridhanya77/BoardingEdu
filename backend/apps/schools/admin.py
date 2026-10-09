from django.contrib import admin

from .models import (
    Board,
    SchoolType,
    Grade,
    Facility,
    School,
    SchoolFacility,
)


# ============================================================
# MASTER DATA
# ============================================================

@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = (
        "board_code",
        "board_name",
        "slug",
        "status",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("board_code", "board_name", "slug")
    prepopulated_fields = {"slug": ("board_name",)}
    ordering = ("board_name",)


@admin.register(SchoolType)
class SchoolTypeAdmin(admin.ModelAdmin):
    list_display = (
        "type_code",
        "type_name",
        "slug",
        "status",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("type_code", "type_name", "slug")
    prepopulated_fields = {"slug": ("type_name",)}
    ordering = ("type_name",)


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = (
        "grade_code",
        "grade_name",
        "sort_order",
        "status",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("grade_code", "grade_name")
    ordering = ("sort_order",)


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = (
        "facility_code",
        "facility_name",
        "category",
        "slug",
        "status",
        "created_at",
    )
    list_filter = ("category", "status")
    search_fields = (
        "facility_code",
        "facility_name",
        "slug",
        "category",
    )
    prepopulated_fields = {"slug": ("facility_name",)}
    ordering = ("category", "facility_name")


# ============================================================
# SCHOOL
# ============================================================

class SchoolFacilityInline(admin.TabularInline):
    model = SchoolFacility
    extra = 1
    autocomplete_fields = ("facility",)


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = (
        "school_code",
        "school_name",
        "city",
        "location",
        "board",
        "school_type",
        "gender",
        "verification_status",
        "status",
    )

    list_filter = (
        "status",
        "verification_status",
        "gender",
        "school_type",
        "board",
        "country",
        "state",
        "city",
    )

    search_fields = (
        "school_code",
        "school_name",
        "short_name",
        "slug",
        "address",
        "pincode",
        "phone",
        "email",
    )

    autocomplete_fields = (
        "country",
        "state",
        "city",
        "location",
        "board",
        "school_type",
    )

    prepopulated_fields = {
        "slug": ("school_name",),
    }

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "Identity",
            {
                "fields": (
                    "school_code",
                    "school_name",
                    "short_name",
                    "slug",
                )
            },
        ),
        (
            "Geography",
            {
                "fields": (
                    "country",
                    "state",
                    "city",
                    "location",
                    "address",
                    "pincode",
                    "lat",
                    "lng",
                )
            },
        ),
        (
            "School Classification",
            {
                "fields": (
                    "board",
                    "school_type",
                    "gender",
                )
            },
        ),
        (
            "Contact & Leadership",
            {
                "fields": (
                    "phone",
                    "email",
                    "principal_name",
                    "established_year",
                )
            },
        ),
        (
            "Enterprise",
            {
                "fields": (
                    "boarding_required",
                    "status",
                    "verification_status",
                    "published_at",
                )
            },
        ),
        (
            "System Information",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    inlines = [
        SchoolFacilityInline,
    ]

    list_select_related = (
        "country",
        "state",
        "city",
        "location",
        "board",
        "school_type",
    )


@admin.register(SchoolFacility)
class SchoolFacilityAdmin(admin.ModelAdmin):
    list_display = (
        "school",
        "facility",
        "available",
        "quantity_or_capacity",
        "created_at",
    )

    list_filter = (
        "available",
    )

    search_fields = (
        "school__school_name",
        "school__school_code",
        "facility__facility_name",
        "facility__facility_code",
    )

    autocomplete_fields = (
        "school",
        "facility",
    )