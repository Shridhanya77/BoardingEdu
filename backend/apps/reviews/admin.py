from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        "school",
        "rating",
        "author_name",
        "status",
        "is_verified",
        "created_at",
    )
    list_filter = ("status", "is_verified", "rating")
    search_fields = (
        "title",
        "body",
        "author_name",
        "school__school_name",
        "user__username",
        "user__email",
    )
    autocomplete_fields = ("school", "user")
    date_hierarchy = "created_at"
    readonly_fields = ("review_id", "created_at", "updated_at")
    list_editable = ("status", "is_verified")
    actions = ("approve_reviews", "reject_reviews")

    @admin.action(description="Approve selected reviews (publish)")
    def approve_reviews(self, request, queryset):
        updated = queryset.update(status=Review.STATUS_PUBLISHED)
        self.message_user(request, f"{updated} review(s) published.")

    @admin.action(description="Reject selected reviews")
    def reject_reviews(self, request, queryset):
        updated = queryset.update(status=Review.STATUS_REJECTED)
        self.message_user(request, f"{updated} review(s) rejected.")
