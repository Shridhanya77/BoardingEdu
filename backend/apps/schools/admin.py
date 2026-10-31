from django import forms
from django.contrib import admin, messages
from django.core.paginator import Paginator
from django.http import HttpResponseForbidden
from django.db.models import Count
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.html import format_html, format_html_join

from apps.users.models import User
from config.school_media import rewrite_school_media_url
from .services import SchoolVerificationError, set_school_verification_status
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
    SchoolVerificationEvent,
)


def media_preview_html(url):
    """Show the R2 proxy URL Django actually serves, not www.boardingedu.com."""
    src = rewrite_school_media_url(url)
    if not src:
        return "No image URL"
    return format_html(
        '<img src="{}" alt="" style="max-width:180px;max-height:120px;object-fit:cover;'
        'border-radius:8px;display:block;margin:6px 0;" />'
        '<a href="{}" target="_blank" rel="noopener">{}</a>',
        src,
        src,
        src,
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


def is_verification_admin(user):
    """Staff admins, super admins, and Django superusers may verify schools.

    A superuser created with ``createsuperuser`` keeps the default Parent role
    until it is changed, but still owns the platform and must reach this queue.
    """
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return getattr(user, "role", None) in (
        User.ROLE_STAFF_ADMIN,
        User.ROLE_SUPER_ADMIN,
    )


class SchoolVerificationAdminForm(forms.Form):
    school_id = forms.UUIDField(widget=forms.HiddenInput)
    status = forms.ChoiceField(choices=School.VERIFICATION_CHOICES)
    note = forms.CharField(
        max_length=1000,
        widget=forms.Textarea(attrs={"rows": 2}),
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
    extra = 5
    autocomplete_fields = ("grade",)
    fields = (
        "grade",
        "seats_available",
        "entry_age_min",
        "entry_age_max",
        "is_active",
    )
    verbose_name = "Grade offered"
    verbose_name_plural = "Grades offered (add multiple grades, then save once)"

class SchoolPhotoInline(admin.TabularInline):
    model = SchoolPhoto
    extra = 1
    readonly_fields = ("photo_preview",)
    fields = (
        "photo_url",
        "photo_preview",
        "caption",
        "alt_text",
        "category",
        "sort_order",
        "status",
    )

    @admin.display(description="Preview")
    def photo_preview(self, obj):
        return media_preview_html(getattr(obj, "photo_url", ""))

class SchoolVideoInline(admin.TabularInline):
    model = SchoolVideo
    extra = 0
    fields = ("video_url", "thumbnail_url", "caption", "category", "sort_order", "status")


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    change_list_template = "admin/schools/school/change_list.html"
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

    @admin.display(description="Logo preview")
    def school_logo_preview(self, obj):
        return media_preview_html(getattr(obj, "school_logo_url", ""))

    @admin.display(description="Cover preview")
    def school_image_preview(self, obj):
        return media_preview_html(getattr(obj, "school_image_url", ""))

    readonly_fields = (
        "created_at",
        "updated_at",
        "verification_status",
        "fee_structures_panel",
        "school_logo_preview",
        "school_image_preview",
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
                    "school_logo_preview",
                    "school_image_url",
                    "school_image_preview",
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
                    "website",
                    "principal_name",
                    "established_year",
                )
            },
        ),
        (
            "School Profile & Admissions",
            {
                "fields": (
                    "tagline",
                    "about",
                    "admission_open",
                ),
                "description": (
                    "Keep the public profile factual and current. This overview "
                    "appears on the school detail page."
                ),
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

    def get_urls(self):
        custom_urls = [
            path(
                "verification-queue/",
                self.admin_site.admin_view(self.verification_queue_view),
                name="schools_school_verification_queue",
            ),
        ]
        return custom_urls + super().get_urls()

    def verification_queue_view(self, request):
        if not is_verification_admin(request.user):
            return HttpResponseForbidden(
                "Verification access requires Staff Admin or Super Admin."
            )

        error_form = None
        if request.method == "POST":
            form = SchoolVerificationAdminForm(request.POST)
            if form.is_valid():
                try:
                    school, _ = set_school_verification_status(
                        school_id=form.cleaned_data["school_id"],
                        actor=request.user,
                        new_status=form.cleaned_data["status"],
                        note=form.cleaned_data["note"],
                    )
                except School.DoesNotExist:
                    form.add_error("school_id", "The selected school no longer exists.")
                except SchoolVerificationError as error:
                    form.add_error(error.field, str(error))
                else:
                    messages.success(
                        request,
                        f"{school.school_name} verification status was updated.",
                    )
                    return redirect("admin:schools_school_verification_queue")
            error_form = form

        pending_schools = School.objects.filter(
            verification_status="PENDING",
        ).select_related("city", "state").order_by("school_name")
        paginator = Paginator(pending_schools, 50)
        page_obj = paginator.get_page(request.GET.get("p"))
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": "Pending school verification",
            "schools": page_obj.object_list,
            "page_obj": page_obj,
            "verification_statuses": School.VERIFICATION_CHOICES,
            "error_form": error_form,
        }
        return render(
            request,
            "admin/schools/school/verification_queue.html",
            context,
        )

    @admin.display(description="Boards")
    def board_names(self, obj):
        return ", ".join(obj.boards.values_list("board_name", flat=True))

    @admin.display(description="School types")
    def school_type_names(self, obj):
        return ", ".join(obj.school_types.values_list("type_name", flat=True))

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        super().save_formset(request, form, formset, change)


@admin.register(SchoolVerificationEvent)
class SchoolVerificationEventAdmin(admin.ModelAdmin):
    list_display = (
        "school",
        "previous_status",
        "new_status",
        "actor",
        "created_at",
    )
    list_filter = ("previous_status", "new_status", "created_at")
    search_fields = ("school__school_name", "school__school_code", "actor__username", "note")
    readonly_fields = (
        "event_id",
        "school",
        "previous_status",
        "new_status",
        "note",
        "actor",
        "created_at",
    )

    def has_module_permission(self, request):
        return is_verification_admin(request.user)

    def has_view_permission(self, request, obj=None):
        return is_verification_admin(request.user)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


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