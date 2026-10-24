import re

from django import forms
from django.contrib import admin
from django.forms.models import BaseInlineFormSet
from .models import AcademicYear, FeeTerm, FeeStructure, FeeItem


class FeeItemInlineFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()

        seen = set()
        for form in self.forms:
            data = form.cleaned_data
            if not data or data.get("DELETE"):
                continue

            item_code = (data.get("item_code") or "").strip()
            if not item_code:
                continue

            grade = data.get("grade")
            school_type = data.get("school_type")
            scope = (
                item_code,
                grade.pk if grade else None,
                school_type.pk if school_type else None,
            )
            if scope in seen:
                form.add_error(
                    "item_code",
                    "This fee code is already used for the same grade and school type in this fee structure.",
                )
                continue
            seen.add(scope)

            existing_items = FeeItem.objects.filter(
                fee_structure=self.instance,
                item_code=item_code,
                grade=grade,
                school_type=school_type,
            )
            if form.instance.pk:
                existing_items = existing_items.exclude(pk=form.instance.pk)
            if existing_items.exists():
                form.add_error(
                    "item_code",
                    "This fee code is already used for the same grade and school type in this fee structure.",
                )


class FeeStructureAdminForm(forms.ModelForm):
    structure_code = forms.CharField(
        max_length=40,
        required=False,
        help_text="Must be unique. Leave blank to generate a code from the school and academic year.",
    )

    class Meta:
        model = FeeStructure
        fields = "__all__"

    def clean_structure_code(self):
        code = (self.cleaned_data.get("structure_code") or "").strip()
        if code and FeeStructure.objects.filter(structure_code=code).exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError(
                "This structure code is already in use. Enter a different code or leave it blank to generate one."
            )
        return code

    def clean(self):
        cleaned_data = super().clean()
        if cleaned_data.get("structure_code"):
            return cleaned_data

        school = cleaned_data.get("school")
        academic_year = cleaned_data.get("academic_year")
        if not school or not academic_year:
            return cleaned_data

        base_code = re.sub(
            r"[^A-Za-z0-9]+",
            "-",
            f"{school.school_code}-{academic_year.year_code}",
        ).strip("-").upper()[:40].rstrip("-")
        code = base_code
        suffix_number = 2
        while FeeStructure.objects.filter(structure_code=code).exclude(pk=self.instance.pk).exists():
            suffix = f"-{suffix_number}"
            code = f"{base_code[:40 - len(suffix)].rstrip('-')}{suffix}"
            suffix_number += 1
        cleaned_data["structure_code"] = code
        return cleaned_data


class FeeItemInline(admin.TabularInline):
    """Allows entering several grade-specific fee rows in one save."""

    model = FeeItem
    formset = FeeItemInlineFormSet
    extra = 5
    autocomplete_fields = ("grade", "school_type")
    verbose_name = "Fee item"
    verbose_name_plural = "Fee items (enter a separate row and amount for each grade)"
    fields = (
        "item_code",
        "item_name",
        "item_category",
        "grade",
        "school_type",
        "amount",
        "payment_frequency",
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
    form = FeeStructureAdminForm
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
        "payment_frequency",
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
