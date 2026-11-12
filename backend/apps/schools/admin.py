from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.core.paginator import Paginator
from django.db import IntegrityError
from django.db.models import Count, Q
from django.http import HttpResponseForbidden
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.html import format_html, format_html_join

from apps.users.models import User
from apps.users.school_admin_scope import (
    AssignedSchoolAdminMixin,
    CatalogVisibleToSchoolAdminMixin,
    manages_own_school,
)
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
    SchoolProfileChange,
    SchoolContentChange,
)
from .content_changes import (
    content_change_rows,
    review_school_content_change,
    submit_school_content_change,
)
from .profile_changes import (
    PROFILE_CHANGE_FIELDS,
    profile_change_rows,
    review_school_profile_change,
    submit_school_profile_changes,
)
from .public_urls import public_school_url


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


def is_school_change_reviewer(user):
    return bool(
        getattr(user, "is_authenticated", False)
        and (
            getattr(user, "is_superuser", False)
            or getattr(user, "role", None) == User.ROLE_SUPER_ADMIN
        )
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
class BoardAdmin(CatalogVisibleToSchoolAdminMixin, admin.ModelAdmin):
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
class SchoolTypeAdmin(CatalogVisibleToSchoolAdminMixin, admin.ModelAdmin):
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
class GradeAdmin(CatalogVisibleToSchoolAdminMixin, admin.ModelAdmin):
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
class FacilityAdmin(CatalogVisibleToSchoolAdminMixin, admin.ModelAdmin):
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

class SchoolContentApprovalInlineMixin:
    def has_add_permission(self, request, obj=None):
        return not manages_own_school(request.user) and super().has_add_permission(
            request, obj
        )

    def has_change_permission(self, request, obj=None):
        return not manages_own_school(request.user) and super().has_change_permission(
            request, obj
        )

    def has_delete_permission(self, request, obj=None):
        return not manages_own_school(request.user) and super().has_delete_permission(
            request, obj
        )


class SchoolFacilityInline(SchoolContentApprovalInlineMixin, admin.TabularInline):
    model = SchoolFacility
    extra = 1
    autocomplete_fields = ("facility",)
    verbose_name = "Facility"
    verbose_name_plural = "Facilities"

class SchoolGradeInline(SchoolContentApprovalInlineMixin, admin.TabularInline):
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
    verbose_name_plural = "Grades"

class SchoolPhotoInline(SchoolContentApprovalInlineMixin, admin.TabularInline):
    model = SchoolPhoto
    extra = 1
    verbose_name = "Photograph"
    verbose_name_plural = "Photographs"
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
    verbose_name = "Video"
    verbose_name_plural = "Videos"
    fields = ("video_url", "thumbnail_url", "caption", "category", "sort_order", "status")


class ProfileGapFilter(admin.SimpleListFilter):
    title = "profile gaps"
    parameter_name = "profile_gap"

    def lookups(self, request, model_admin):
        return (
            ("logo", "Missing logo"),
            ("cover", "Missing cover photograph"),
            ("about", "Missing description"),
            ("contact", "Missing phone and email"),
            ("locality", "Missing locality"),
            ("board", "Missing education board"),
            ("fees", "Missing published fees"),
        )

    def queryset(self, request, queryset):
        blank = {
            "logo": Q(school_logo_url="") | Q(school_logo_url__isnull=True),
            "cover": Q(school_image_url="") | Q(school_image_url__isnull=True),
            "about": Q(about="") | Q(about__isnull=True),
            "contact": (Q(phone="") | Q(phone__isnull=True)) & (Q(email="") | Q(email__isnull=True)),
            "locality": Q(location__isnull=True),
        }
        if self.value() in blank:
            return queryset.filter(blank[self.value()])
        if self.value() == "board":
            return queryset.annotate(board_count=Count("boards", distinct=True)).filter(board_count=0)
        if self.value() == "fees":
            return queryset.exclude(fee_structures__published=True, fee_structures__status=True)
        return queryset


@admin.register(School)
class SchoolAdmin(AssignedSchoolAdminMixin, admin.ModelAdmin):
    school_filter = "pk"
    school_admin_can_add = False
    school_admin_can_delete = False
    change_list_template = "admin/schools/school/change_list.html"
    change_form_template = "admin/schools/school/change_form.html"
    list_per_page = 8
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
        ProfileGapFilter,
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

    @admin.display(description="Fee management")
    def school_admin_fee_workspace_link(self, _obj):
        return format_html(
            '<a class="button" href="{}?section=fees#fees">Manage fees in the school workspace</a>',
            reverse("admin:school_workspace"),
        )

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
        "profile_review_status",
    )

    fieldsets = (
        (
            "Logo and cover",
            {
                "fields": (
                    "school_logo_url",
                    "school_logo_preview",
                    "school_image_url",
                    "school_image_preview",
                ),
                "description": "Paste the image address already stored for this school. Saving does not upload a new file.",
            },
        ),
        (
            "Basic information",
            {
                "fields": (
                    "school_name",
                    "short_name",
                    "school_code",
                    "slug",
                    "established_year",
                )
            },
        ),
        (
            "Location",
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
            "Academics",
            {
                "fields": (
                    "boards",
                    "school_types",
                    "gender",
                )
            },
        ),
        (
            "Contact",
            {
                "fields": (
                    "phone",
                    "email",
                    "website",
                    "principal_name",
                )
            },
        ),
        (
            "Profile",
            {
                "fields": (
                    "tagline",
                    "about",
                    "admission_open",
                    "profile_review_status",
                ),
                "description": (
                    "Keep the public profile factual and current. Core school details "
                    "and related facilities, grades, fees, documents, and photographs "
                    "remain unchanged publicly until a Super Admin approves them."
                ),
            },
        ),
        (
            "Publishing",
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

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("school_types")

    def get_urls(self):
        custom_urls = [
            path(
                "profile-review/",
                self.admin_site.admin_view(self.profile_review_queue_view),
                name="schools_school_profile_review_queue",
            ),
            path(
                "verification-queue/",
                self.admin_site.admin_view(self.verification_queue_view),
                name="schools_school_verification_queue",
            ),
        ]
        return custom_urls + super().get_urls()

    def profile_review_queue_view(self, request):
        if not is_school_change_reviewer(request.user):
            return HttpResponseForbidden(
                "School content review access requires Super Admin."
            )

        if request.method == "POST":
            action = request.POST.get("action")
            change_id = request.POST.get("change_id")
            content_change_id = request.POST.get("content_change_id")
            note = request.POST.get("review_note", "").strip()
            if action not in {"approve", "reject"}:
                messages.error(request, "Choose whether to approve or reject this submission.")
            elif action == "reject" and not note:
                messages.error(request, "Add a reason before rejecting a submission.")
            else:
                try:
                    selected_change_id = forms.UUIDField().clean(
                        content_change_id or change_id
                    )
                except ValidationError:
                    messages.error(request, "Choose a valid school submission.")
                else:
                    if content_change_id:
                        try:
                            change = review_school_content_change(
                                change_id=selected_change_id,
                                reviewer=request.user,
                                approve=action == "approve",
                                note=note,
                            )
                        except SchoolContentChange.DoesNotExist:
                            messages.error(request, "That content submission no longer exists.")
                        except (ValueError, ValidationError) as error:
                            messages.error(request, str(error))
                        except ObjectDoesNotExist:
                            messages.error(
                                request,
                                "A referenced record no longer exists. No public changes were applied.",
                            )
                        except IntegrityError:
                            messages.error(
                                request,
                                "This submission conflicts with current school data. No public changes were applied.",
                            )
                        else:
                            messages.success(
                                request,
                                f"{change.school.school_name} {change.get_content_type_display().lower()} submission {change.get_status_display().lower()}.",
                            )
                            return redirect("admin:schools_school_profile_review_queue")
                    else:
                        try:
                            change = review_school_profile_change(
                                change_id=selected_change_id,
                                reviewer=request.user,
                                approve=action == "approve",
                                note=note,
                            )
                        except SchoolProfileChange.DoesNotExist:
                            messages.error(request, "That profile submission no longer exists.")
                        except ValueError as error:
                            messages.error(request, str(error))
                        else:
                            messages.success(
                                request,
                                f"{change.school.school_name} profile submission {change.get_status_display().lower()}.",
                            )
                            return redirect("admin:schools_school_profile_review_queue")

        pending_changes = (
            SchoolProfileChange.objects.filter(status=SchoolProfileChange.STATUS_PENDING)
            .select_related("school", "submitted_by", "school__country", "school__state", "school__city")
            .order_by("submitted_at")
        )
        rows = [
            {
                "change": change,
                "fields": profile_change_rows(change),
                "school_url": reverse("admin:schools_school_change", args=[change.school_id]),
            }
            for change in pending_changes
        ]
        pending_content_changes = (
            SchoolContentChange.objects.filter(
                status=SchoolContentChange.STATUS_PENDING
            )
            .select_related("school", "submitted_by")
            .order_by("submitted_at")
        )
        content_rows = [
            {
                "change": change,
                "fields": content_change_rows(change),
                "school_url": reverse(
                    "admin:schools_school_change", args=[change.school_id]
                ),
            }
            for change in pending_content_changes
        ]
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": "Pending school changes",
            "pending_changes": rows,
            "pending_content_changes": content_rows,
        }
        return render(
            request,
            "admin/schools/school/profile_change_queue.html",
            context,
        )

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

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if manages_own_school(request.user):
            for name in (
                "school_code",
                "slug",
                "status",
                "is_featured",
                "verification_status",
                "published_at",
                "boarding_required",
                "school_admin_fee_workspace_link",
            ):
                if name not in fields:
                    fields.append(name)
        return fields

    def get_prepopulated_fields(self, request, obj=None):
        if manages_own_school(request.user):
            return {}
        return super().get_prepopulated_fields(request, obj)

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        if not manages_own_school(request.user):
            return fieldsets
        school_admin_fieldsets = []
        for title, options in fieldsets:
            options = dict(options)
            if title == "Fees":
                options["fields"] = ("school_admin_fee_workspace_link",)
            school_admin_fieldsets.append((title, options))
        return school_admin_fieldsets

    @admin.display(description="Profile review")
    def profile_review_status(self, obj):
        if obj is None or obj.pk is None:
            return "Save the profile before submitting changes for review."
        latest = obj.profile_changes.order_by("-submitted_at", "-pk").first()
        if latest is None:
            return "No profile edits are awaiting review."
        if latest.status == SchoolProfileChange.STATUS_PENDING:
            return (
                f"Submitted {latest.submitted_at:%b %d, %Y at %H:%M}. "
                "The currently approved profile remains public until these edits are approved."
            )
        if latest.status == SchoolProfileChange.STATUS_REJECTED:
            return (
                f"Your last profile submission was rejected on {latest.reviewed_at:%b %d, %Y}. "
                f"Review note: {latest.review_note or 'No reason was recorded.'}"
            )
        reviewed = (
            f" on {latest.reviewed_at:%b %d, %Y}"
            if latest.reviewed_at
            else ""
        )
        return f"Your last profile submission was {latest.get_status_display().lower()}{reviewed}."

    view_on_site = True

    def has_view_on_site_permission(self, request, obj=None):
        return bool(
            obj
            and obj.status
            and obj.verification_status == "VERIFIED"
        )

    def get_view_on_site_url(self, obj):
        return public_school_url(obj)

    def save_model(self, request, obj, form, change):
        if manages_own_school(request.user):
            values = {
                field_name: form.cleaned_data[field_name]
                for field_name in form.changed_data
                if field_name in PROFILE_CHANGE_FIELDS
            }
            pending = submit_school_profile_changes(obj, request.user, values)
            if pending:
                messages.success(
                    request,
                    "Your profile edits were submitted for Super Admin approval. The approved public profile remains live.",
                )
            elif values:
                messages.info(request, "There are no profile changes awaiting review.")
            return
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        if manages_own_school(request.user):
            for formset in formsets:
                if formset.model is SchoolVideo:
                    self.save_formset(request, form, formset, change)
            return
        super().save_related(request, form, formsets, change)

    def save_formset(self, request, form, formset, change):
        if manages_own_school(request.user):
            if formset.model is not SchoolVideo:
                return
            videos = formset.save(commit=False)
            for video in formset.deleted_objects:
                submit_school_content_change(
                    form.instance,
                    request.user,
                    SchoolContentChange.TYPE_VIDEO,
                    f"VIDEO:{video.video_id}",
                    {},
                    action=SchoolContentChange.ACTION_DELETE,
                    target_id=video.video_id,
                )
            for video in videos:
                video.school = form.instance
                submit_school_content_change(
                    form.instance,
                    request.user,
                    SchoolContentChange.TYPE_VIDEO,
                    f"VIDEO:{video.video_id}",
                    {
                        "video_url": video.video_url,
                        "thumbnail_url": video.thumbnail_url,
                        "caption": video.caption,
                        "category": video.category,
                        "sort_order": video.sort_order,
                        "status": video.status,
                    },
                    target_id=video.video_id,
                )
            return
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
class SchoolFacilityAdmin(AssignedSchoolAdminMixin, admin.ModelAdmin):
    school_admin_can_add = False
    school_admin_can_change = False
    school_admin_can_delete = False

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
class SchoolGradeAdmin(AssignedSchoolAdminMixin, admin.ModelAdmin):
    school_admin_can_add = False
    school_admin_can_change = False
    school_admin_can_delete = False

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