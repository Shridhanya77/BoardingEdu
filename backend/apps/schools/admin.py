from django.contrib import admin
from django.db.models import Count
from django.urls import reverse
from django.utils.html import format_html, format_html_join

from .models import (
    Board,
    SchoolType,
    Grade,
    Facility,
    School,
    SchoolPhoto,
    SchoolVideo,
    SchoolFacility,
    SchoolGrade,
    SchoolFAQ,
)


def render_fee_structures_panel(obj):
    if obj is None or obj.pk is None:
        return "Save the school before adding its fee structures."

    add_url = f"{reverse('admin:fees_feestructure_add')}?school={obj.pk}"
    structures = (
        obj.fee_structures.select_related("academic_year")
        .annotate(item_count=Count("fee_items"))
        .order_by("-academic_year__start_date")
    )
    if not structures:
        return format_html(
            '<p>No fee structures yet. '
            '<a class="button" href="{}">Add fee structure</a></p>'
            '<p>Create the academic-year structure, add fee components, then publish it '
            'to display it on the school profile.</p>',
            add_url,
        )

    rows = format_html_join(
        "",
        '<li><a href="{}">{}</a> — {} · {} fee item{}</li>',
        (
            (
                reverse("admin:fees_feestructure_change", args=(structure.pk,)),
                f"{structure.academic_year.year_code}: {structure.structure_name}",
                "Published" if structure.status and structure.published else "Draft",
                structure.item_count,
                "" if structure.item_count == 1 else "s",
            )
            for structure in structures
        ),
    )
    return format_html(
        '<ul>{}</ul><p><a class="button" href="{}">Add fee structure</a></p>',
        rows,
        add_url,
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
    ordering = ("type_name",)
    readonly_fields = (
        "type_code",
        "type_name",
        "slug",
        "status",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


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


@admin.register(SchoolFAQ)
class SchoolFAQAdmin(admin.ModelAdmin):
    list_display = (
        "question",
        "country",
        "state",
        "city",
        "location",
        "board",
        "school_type",
        "sort_order",
        "status",
    )
    list_filter = ("status", "country", "state", "city", "location", "board", "school_type")
    search_fields = ("question", "answer")
    ordering = ("sort_order", "question")


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

class SchoolGradeInline(admin.TabularInline):
    model = SchoolGrade
    extra = 1
    autocomplete_fields = ("grade",)
    list_display_links = ("grade",)

class SchoolPhotoInline(admin.TabularInline):
    model = SchoolPhoto
    extra = 1
    fields = ("photo_url", "caption", "alt_text", "category", "sort_order", "status")

class SchoolVideoInline(admin.TabularInline):
    model = SchoolVideo
    extra = 0
    fields = ("video_url", "thumbnail_url", "caption", "category", "sort_order", "status")


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = (
        "school_code",
        "school_name",
        "city",
        "location",
        "board_names",
        "school_type_names",
        "gender",
        "verification_status",
        "is_featured",
        "status",
    )

    list_filter = (
        "status",
        "verification_status",
        "is_featured",
        "gender",
        "school_types",
        "boards",
        "country",
        "state",
        "city",
    )

    search_fields = (
        "school_code",
        "school_name",
        "short_name",
        "school_logo_url",
        "school_image_url",
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
    )
    filter_horizontal = ("boards", "school_types")

    prepopulated_fields = {
        "slug": ("school_name",),
    }

    @admin.display(description="Fee structures")
    def fee_structures_panel(self, obj):
        return render_fee_structures_panel(obj)

    readonly_fields = (
        "created_at",
        "updated_at",
        "fee_structures_panel",
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
                    "school_logo_url",
                    "school_image_url",
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
                    "boards",
                    "school_types",
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
                    "is_featured",
                    "status",
                    "verification_status",
                    "published_at",
                )
            },
        ),
        (
            "Fees",
            {
                "fields": ("fee_structures_panel",),
                "description": (
                    "Manage academic-year fee schedules and their fee items here. "
                    "Only active, published schedules appear on the public school profile."
                ),
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
        SchoolPhotoInline,
        SchoolVideoInline,
        SchoolFacilityInline,
        SchoolGradeInline,
    ]

    list_select_related = (
        "country",
        "state",
        "city",
        "location",
    )

    @admin.display(description="Boards")
    def board_names(self, obj):
        return ", ".join(obj.boards.values_list("board_name", flat=True))

    @admin.display(description="School types")
    def school_type_names(self, obj):
        return ", ".join(obj.school_types.values_list("type_name", flat=True))


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

@admin.register(SchoolGrade)
class SchoolGradeAdmin(admin.ModelAdmin):
    list_display = (
        "school",
        "grade",
        "seats_available",
        "entry_age_min",
        "entry_age_max",
        "is_active",
    )

    list_filter = (
        "is_active",
        "grade",
    )

    search_fields = (
        "school__school_name",
        "school__school_code",
        "grade__grade_name",
        "grade__grade_code",
    )

    autocomplete_fields = (
        "school",
        "grade",
    )

    list_select_related = ("school", "grade")