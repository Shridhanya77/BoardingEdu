import contextvars

from django.contrib import admin

from apps.users.school_admin_scope import AssignedSchoolAdminMixin, manages_own_school

from .models import Child, AdmissionEnquiry, CounsellingRequest

_admin_request = contextvars.ContextVar("lead_admin_request", default=None)


def _contacts_open(enquiry):
    request = _admin_request.get()
    if request is None or not manages_own_school(request.user):
        return True
    from apps.subscriptions.access import viewer_can_see_contacts

    return viewer_can_see_contacts(request.user, enquiry)


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ("name", "parent_profile", "date_of_birth", "gender", "current_grade")
    list_filter = ("gender", "current_grade")
    search_fields = ("name", "parent_profile__user__username", "parent_profile__user__email")
    autocomplete_fields = ("parent_profile", "current_grade")
    readonly_fields = ("created_at", "updated_at")


@admin.register(AdmissionEnquiry)
class AdmissionEnquiryAdmin(AssignedSchoolAdminMixin, admin.ModelAdmin):
    school_admin_can_add = False
    school_admin_can_delete = False
    list_display = (
        "enquiry_code",
        "parent_name",
        "contact_detail",
        "applying_for_grade",
        "status",
        "priority",
        "next_followup_at",
        "created_at",
    )
    list_editable = ("status", "priority")
    list_select_related = ("school", "applying_for_grade", "parent_profile__user")
    list_filter = ("status", "priority", "source", "school")
    search_fields = (
        "enquiry_code",
        "message",
        "guest_full_name",
        "guest_email",
        "guest_phone",
        "parent_profile__user__username",
    )
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

    @admin.display(description="Parent")
    def parent_name(self, obj):
        if not _contacts_open(obj):
            return "Locked"
        if obj.parent_profile_id and obj.parent_profile.user_id:
            user = obj.parent_profile.user
            return user.get_full_name().strip() or user.username
        return obj.guest_full_name or "—"

    @admin.display(description="Contact")
    def contact_detail(self, obj):
        if not _contacts_open(obj):
            return "Subscription required"
        if obj.parent_profile_id and obj.parent_profile.user_id:
            user = obj.parent_profile.user
            return user.phone or user.email or "—"
        return obj.guest_phone or obj.guest_email or "—"

    def _with_request(self, request, view):
        token = _admin_request.set(request)
        try:
            return view()
        finally:
            _admin_request.reset(token)

    @admin.display(description="Contacts")
    def contact_lock_notice(self, obj):
        return (
            "Parent name, student name, mobile number, and email stay hidden "
            "until this school has an active subscription."
        )

    def _contacts_locked(self, request, obj=None):
        if not manages_own_school(request.user) or obj is None:
            return False
        from apps.subscriptions.access import viewer_can_see_contacts

        return not viewer_can_see_contacts(request.user, obj)

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        if manages_own_school(request.user):
            extra_context.setdefault("title", "Leads for your school")
        return self._with_request(
            request,
            lambda: super().changelist_view(request, extra_context),
        )

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        return self._with_request(
            request,
            lambda: super().changeform_view(request, object_id, form_url, extra_context),
        )

    def get_search_fields(self, request):
        if manages_own_school(request.user):
            from apps.subscriptions.access import current_subscription

            school = request.user.school_admin_profile.school
            if current_subscription(school) is None:
                return ("enquiry_code", "source", "status", "applying_for_grade__grade_name")
        return self.search_fields

    def get_fieldsets(self, request, obj=None):
        if self._contacts_locked(request, obj):
            return (
                (
                    "Enquiry",
                    {
                        "fields": (
                            "enquiry_id",
                            "enquiry_code",
                            "source",
                            "applying_for_grade",
                            "academic_year",
                            "status",
                            "priority",
                            "next_followup_at",
                            "created_at",
                        )
                    },
                ),
                ("Contacts", {"fields": ("contact_lock_notice",)}),
            )
        return super().get_fieldsets(request, obj)

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if "contact_lock_notice" not in fields:
            fields.append("contact_lock_notice")
        if manages_own_school(request.user):
            fields.extend([
                "enquiry_code",
                "source",
                "message",
                "parent_profile",
                "child",
                "school",
                "academic_year",
                "applying_for_grade",
                "guest_full_name",
                "guest_email",
                "guest_phone",
                "guest_child_name",
                "guest_child_dob",
                "guest_child_gender",
                "assigned_to",
            ])
        return fields

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
            "Guest contact",
            {
                "fields": (
                    "guest_full_name",
                    "guest_email",
                    "guest_phone",
                    "guest_child_name",
                    "guest_child_dob",
                    "guest_child_gender",
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


AdmissionEnquiry._meta.verbose_name = "Lead"
AdmissionEnquiry._meta.verbose_name_plural = "Leads"


@admin.register(CounsellingRequest)
class CounsellingRequestAdmin(admin.ModelAdmin):
    list_display = ("reference", "parent_name", "email", "phone", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("reference", "parent_name", "email", "phone", "home_city", "message")
    autocomplete_fields = ("preferred_country", "preferred_state", "preferred_school")
    filter_horizontal = ("preferred_cities", "grades", "school_types", "boards")
    readonly_fields = ("request_id", "reference", "created_at", "updated_at")
