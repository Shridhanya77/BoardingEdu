from rest_framework import serializers

from .html import sanitize_blog_html
from .models import BlogCategory, BlogPost


def _absolute_media_url(url, request):
    if not url:
        return None
    if url.startswith(("http://", "https://")):
        return url
    if request is not None:
        return request.build_absolute_uri(url)
    return url


class BlogCategorySerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = BlogCategory
        fields = ["name", "slug", "description", "image_url", "display_order"]

    def get_image_url(self, category):
        if not category.image:
            return None
        try:
            return _absolute_media_url(category.image.url, self.context.get("request"))
        except ValueError:
            return None


class BlogPostCardSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = [
            "title",
            "slug",
            "short_description",
            "cover_image_url",
            "category",
            "author_name",
            "featured",
            "reading_time_minutes",
            "published_at",
            "updated_at",
        ]

    def get_category(self, post):
        return {"name": post.category.name, "slug": post.category.slug}

    def get_cover_image_url(self, post):
        if not post.cover_image:
            return None
        try:
            return _absolute_media_url(post.cover_image.url, self.context.get("request"))
        except ValueError:
            return None

    def get_author_name(self, post):
        return (post.author_name or "").strip() or "BoardingEdu Editorial"


class BlogPostDetailSerializer(BlogPostCardSerializer):
    content = serializers.SerializerMethodField()
    headings = serializers.SerializerMethodField()
    related = serializers.SerializerMethodField()
    meta_title = serializers.SerializerMethodField()
    meta_description = serializers.SerializerMethodField()
    canonical_url = serializers.SerializerMethodField()

    class Meta(BlogPostCardSerializer.Meta):
        fields = BlogPostCardSerializer.Meta.fields + [
            "content",
            "headings",
            "related",
            "meta_title",
            "meta_description",
            "canonical_url",
            "status",
            "created_at",
        ]

    def _sanitized(self, post):
        cached = getattr(post, "_sanitized_article", None)
        if cached is None:
            cached = sanitize_blog_html(post.content)
            post._sanitized_article = cached
        return cached

    def get_content(self, post):
        return self._sanitized(post).html

    def get_headings(self, post):
        return self._sanitized(post).headings

    def get_related(self, post):
        return BlogPostCardSerializer(post.related_posts(), many=True, context=self.context).data

    def get_meta_title(self, post):
        return (post.meta_title or "").strip() or post.title

    def get_meta_description(self, post):
        return (post.meta_description or "").strip() or post.short_description

    def get_canonical_url(self, post):
        return (post.canonical_url or "").strip()


class BlogSubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    consent = serializers.BooleanField()

    def validate_email(self, value):
        return value.strip().lower()

    def validate_consent(self, value):
        if value is not True:
            raise serializers.ValidationError("Consent is required to subscribe.")
        return value
