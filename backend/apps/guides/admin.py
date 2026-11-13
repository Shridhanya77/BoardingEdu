from django.contrib import admin

from .models import GuideArticle, GuideCategory


@admin.register(GuideCategory)
class GuideCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sort_order", "status")
    list_filter = ("status",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("sort_order", "name")


@admin.register(GuideArticle)
class GuideArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "updated_on", "status", "sort_order")
    list_filter = ("status", "category")
    search_fields = ("title", "summary", "slug")
    prepopulated_fields = {"slug": ("title",)}
    ordering = ("sort_order", "title")
    fieldsets = (
        (None, {"fields": ("title", "slug", "summary", "category", "cover_image_url")}),
        ("Content", {"fields": ("sections",)}),
        ("Publishing", {"fields": ("updated_on", "reading_minutes", "sort_order", "status")}),
    )
