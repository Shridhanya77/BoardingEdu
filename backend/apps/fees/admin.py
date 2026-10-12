from django.contrib import admin
from .models import AcademicYear, FeeTerm, FeeStructure, FeeItem


class FeeItemInline(admin.TabularInline):
    """Allows editing fee line items directly inside a FeeStructure."""

    model = FeeItem
    extra = 1
    autocomplete_fields = ("grade", "school_type")
    fields = (
        "item_code",
        "item_name",
        "item_category",
        "grade",
        "school_type",
        "amount",
        "tax_rate_pct",
        "is_refundable",
        "sort_order",
        "description",
    )


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = (
        "year_code",
        "year_name",
        "start_date",
        "end_date",
        "is_current",
        "status",
        "created_at",
    )
    list_filter = ("status", "is_current")
    search_fields = ("year_code", "year_name")
    ordering = ("-start_date",)
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "start_date"
    fieldsets = (
        ("Identity", {"fields": ("year_code", "year_name")}),
        ("Duration", {"fields": ("start_date", "end_date")}),
        ("Status", {"fields": ("status", "is_current")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(FeeTerm)
class FeeTermAdmin(admin.ModelAdmin):
    list_display = (
        "term_code",
        "term_name",
        "academic_year",
        "term_frequency",
        "start_date",
        "end_date",
        "due_date",
        "status",
    )
    list_filter = ("term_frequency", "status", "academic_year")
    search_fields = ("term_code", "term_name", "academic_year__year_code")
    autocomplete_fields = ("academic_year",)
    ordering = ("academic_year__start_date", "start_date")
    readonly_fields = ("created_at", "updated_at")


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = (
        "structure_code",
        "structure_name",
        "school",
        "academic_year",
        "effective_from",
        "payment_terms",
        "status",
        "published",
    )
    list_filter = ("status", "published", "academic_year", "school__school_types", "school__boards")
    search_fields = (
        "structure_code",
        "structure_name",
        "school__school_name",
        "school__school_code",
        "academic_year__year_code",
    )
    autocomplete_fields = ("school", "academic_year", "payment_terms")
    readonly_fields = ("published_at", "created_at", "updated_at")
    date_hierarchy = "effective_from"
    fieldsets = (
        (
            "Identity",
            {"fields": ("structure_code", "structure_name", "description")},
        ),
        (
            "Scope",
            {"fields": ("school", "academic_year")},
        ),
        (
            "Effective Window",
            {"fields": ("effective_from", "effective_to", "payment_terms")},
        ),
        (
            "Publishing",
            {"fields": ("status", "published", "published_at")},
        ),
        (
            "Audit",
            {"fields": ("created_at", "updated_at")},
        ),
    )
    inlines = [FeeItemInline]


@admin.register(FeeItem)
class FeeItemAdmin(admin.ModelAdmin):
    list_display = (
        "item_code",
        "item_name",
        "item_category",
        "fee_structure",
        "grade",
        "school_type",
        "amount",
        "tax_rate_pct",
        "is_refundable",
        "sort_order",
    )
    list_filter = ("item_category", "is_refundable", "grade", "school_type")
    search_fields = (
        "item_code",
        "item_name",
        "fee_structure__structure_code",
        "fee_structure__school__school_name",
    )
    autocomplete_fields = ("fee_structure", "grade", "school_type")
    ordering = ("fee_structure__structure_code", "sort_order", "item_name")
    readonly_fields = ("created_at", "updated_at")
