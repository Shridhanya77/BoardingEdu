from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .html import sanitize_blog_html
from .models import RESERVED_SLUGS, BlogCategory, BlogImage, BlogPost, BlogSubscriber


def _can_manage_blogs(request):
    user = request.user
    if not user.is_authenticated or not user.is_active or not user.is_staff:
        return False
    if user.is_superuser:
        return True
    return getattr(user, "role", None) in {"STAFF_ADMIN", "SUPER_ADMIN"}


class BlogAdminMixin:
    def has_module_permission(self, request):
        return _can_manage_blogs(request)

    def has_view_permission(self, request, obj=None):
        return _can_manage_blogs(request)

    def has_add_permission(self, request):
        return _can_manage_blogs(request)

    def has_change_permission(self, request, obj=None):
        return _can_manage_blogs(request)

    def has_delete_permission(self, request, obj=None):
        return _can_manage_blogs(request)


@admin.register(BlogCategory)
class BlogCategoryAdmin(BlogAdminMixin, admin.ModelAdmin):
    list_display = ("name", "slug", "display_order", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("display_order", "name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(BlogPost)
class BlogPostAdmin(BlogAdminMixin, admin.ModelAdmin):
    list_display = ("title", "category", "status", "featured", "author_name", "published_at", "updated_at")
    list_filter = ("status", "featured", "category")
    search_fields = ("title", "slug", "short_description", "author_name", "content")
    prepopulated_fields = {"slug": ("title",)}
    raw_id_fields = ("author",)
    date_hierarchy = "published_at"
    readonly_fields = (
        "reading_time_minutes",
        "created_at",
        "updated_at",
        "content_preview",
        "public_link",
    )
    actions = ("publish_articles", "unpublish_articles", "archive_articles", "mark_featured", "unmark_featured")
    fieldsets = (
        ("Article", {"fields": ("title", "slug", "category", "short_description", "author", "author_name")}),
        ("Content", {"fields": ("content", "content_preview")}),
        ("Media", {"fields": ("cover_image",)}),
        ("SEO", {"fields": ("meta_title", "meta_description", "canonical_url", "public_link")}),
        ("Publishing", {"fields": ("status", "featured", "published_at", "reading_time_minutes", "created_at", "updated_at")}),
    )

    class Media:
        css = {"all": ("blogs/admin/blog_editor.css",)}
        js = ("blogs/admin/blog_editor.js",)

    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        if request.user.is_authenticated and not initial.get("author_name"):
            initial["author_name"] = request.user.get_full_name() or request.user.get_username()
        return initial

    @admin.display(description="Preview")
    def content_preview(self, obj):
        if not obj or not obj.content:
            return "Save the article to preview the formatted text."
        safe_html = sanitize_blog_html(obj.content).html
        return mark_safe(f'<div class="blog-admin-preview">{safe_html}</div>')

    @admin.display(description="Website link")
    def public_link(self, obj):
        if not obj or not obj.slug or obj.slug in RESERVED_SLUGS:
            return "Save the article to get a link."
        from django.conf import settings

        base = settings.PUBLIC_FRONTEND_URL.rstrip("/")
        if obj.is_public:
            url = f"{base}/blogs/{obj.slug}/"
            label = "View published article"
        else:
            url = f"{base}/blogs/preview/{obj.slug}/"
            label = "Preview draft on the website"
        return format_html('<a href="{}" target="_blank" rel="noopener noreferrer">{}</a>', url, label)

    @admin.action(description="Publish selected articles now")
    def publish_articles(self, request, queryset):
        now = timezone.now()
        updated = 0
        failed = []
        for post in queryset:
            post.status = BlogPost.STATUS_PUBLISHED
            if post.published_at is None or post.published_at > now:
                post.published_at = now
            try:
                post.save()
            except ValidationError as exc:
                failed.append(f"{post.title}: {exc.messages[0] if getattr(exc, 'messages', None) else exc}")
                continue
            updated += 1
        self.message_user(request, f"Published {updated} article(s).")
        if failed:
            self.message_user(request, "Could not publish: " + "; ".join(failed), level=messages.ERROR)

    @admin.action(description="Unpublish selected articles")
    def unpublish_articles(self, request, queryset):
        count = 0
        for post in queryset:
            post.status = BlogPost.STATUS_DRAFT
            post.save()
            count += 1
        self.message_user(request, f"Moved {count} article(s) to draft.")

    @admin.action(description="Archive selected articles")
    def archive_articles(self, request, queryset):
        count = 0
        for post in queryset:
            post.status = BlogPost.STATUS_ARCHIVED
            post.save()
            count += 1
        self.message_user(request, f"Archived {count} article(s).")

    @admin.action(description="Mark selected articles as featured")
    def mark_featured(self, request, queryset):
        updated = queryset.update(featured=True)
        self.message_user(request, f"Marked {updated} article(s) as featured.")

    @admin.action(description="Remove featured status")
    def unmark_featured(self, request, queryset):
        updated = queryset.update(featured=False)
        self.message_user(request, f"Removed featured status from {updated} article(s).")


@admin.register(BlogImage)
class BlogImageAdmin(BlogAdminMixin, admin.ModelAdmin):
    list_display = ("alt_text", "image_url", "created_at")
    search_fields = ("alt_text",)
    readonly_fields = ("image_url", "created_at")

    @admin.display(description="Public URL")
    def image_url(self, obj):
        if not obj.image:
            return "—"
        try:
            url = obj.image.url
        except ValueError:
            return "—"
        return format_html('<a href="{}" target="_blank" rel="noopener noreferrer">{}</a>', url, url)


@admin.register(BlogSubscriber)
class BlogSubscriberAdmin(BlogAdminMixin, admin.ModelAdmin):
    list_display = ("email", "consent", "source", "consented_at", "created_at")
    search_fields = ("email",)
    readonly_fields = ("email", "consent", "consented_at", "source", "created_at")

    def has_add_permission(self, request):
        return False
