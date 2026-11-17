import math

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from .html import sanitize_blog_html, visible_word_count
from .images import store_optimized_image


RESERVED_SLUGS = {"category", "preview", "search", "featured", "latest", "subscribe"}
WORDS_PER_MINUTE = 200


class BlogCategory(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="blogs/categories/", blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "blog_categories"
        ordering = ["display_order", "name"]
        verbose_name = "Blog category"
        verbose_name_plural = "Blog categories"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:90]
        store_optimized_image(self, "image")
        super().save(*args, **kwargs)


class BlogPostQuerySet(models.QuerySet):
    def published(self):
        return self.filter(
            status=BlogPost.STATUS_PUBLISHED,
            published_at__lte=timezone.now(),
            category__is_active=True,
        )


class BlogPost(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PUBLISHED = "published"
    STATUS_ARCHIVED = "archived"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PUBLISHED, "Published"),
        (STATUS_ARCHIVED, "Archived"),
    ]

    title = models.CharField(max_length=220)
    slug = models.SlugField(max_length=220, unique=True)
    category = models.ForeignKey(
        BlogCategory,
        on_delete=models.PROTECT,
        related_name="posts",
    )
    short_description = models.TextField(validators=[MaxLengthValidator(400)])
    content = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="blogs/covers/", blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="blog_posts",
        null=True,
        blank=True,
    )
    author_name = models.CharField(max_length=120, default="BoardingEdu Editorial")
    featured = models.BooleanField(default=False, db_index=True)
    status = models.CharField(
        max_length=12,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
    )
    meta_title = models.CharField(max_length=180, blank=True)
    meta_description = models.CharField(max_length=320, blank=True)
    canonical_url = models.URLField(max_length=500, blank=True)
    reading_time_minutes = models.PositiveSmallIntegerField(default=0, editable=False)
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Leave blank to publish immediately. A future date hides the article until then.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BlogPostQuerySet.as_manager()

    class Meta:
        db_table = "blog_posts"
        ordering = ["-published_at", "-created_at"]
        indexes = [
            models.Index(fields=["status", "published_at"], name="blog_post_status_published"),
            models.Index(fields=["featured", "status"], name="blog_post_featured_status"),
        ]

    def __str__(self):
        return self.title

    @property
    def is_public(self):
        return (
            self.status == self.STATUS_PUBLISHED
            and self.published_at is not None
            and self.published_at <= timezone.now()
            and self.category_id is not None
            and getattr(self.category, "is_active", False)
        )

    def clean(self):
        super().clean()
        errors = {}
        slug = (self.slug or "").strip().lower()
        if slug in RESERVED_SLUGS:
            errors["slug"] = "This address is reserved. Choose another slug."
        if self.canonical_url and not self.canonical_url.lower().startswith(("https://", "http://")):
            errors["canonical_url"] = "Enter an absolute http or https URL."
        if self.status == self.STATUS_PUBLISHED:
            if not (self.short_description or "").strip():
                errors["short_description"] = "Published articles need a short description."
            if not (self.content or "").strip():
                errors["content"] = "Published articles need article text."
            if not self.cover_image:
                errors["cover_image"] = "Published articles need a cover image."
            if not (self.author_name or "").strip():
                errors["author_name"] = "Published articles need an author name."
        if errors:
            raise ValidationError(errors)

    def related_posts(self, limit=3):
        if not self.pk:
            return BlogPost.objects.none()
        published = BlogPost.objects.published().exclude(pk=self.pk).select_related("category", "author")
        same_category = list(published.filter(category_id=self.category_id)[:limit])
        if len(same_category) >= limit:
            return same_category
        seen = [post.pk for post in same_category]
        filler = list(published.exclude(pk__in=seen)[: limit - len(same_category)])
        return same_category + filler

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:220]
        self.slug = self.slug.lower()
        sanitized = sanitize_blog_html(self.content)
        self.content = sanitized.html
        words = visible_word_count(self.content)
        self.reading_time_minutes = math.ceil(words / WORDS_PER_MINUTE) if words else 0
        if self.status == self.STATUS_PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        if self.author_id and not (self.author_name or "").strip():
            self.author_name = self.author.get_full_name() or self.author.username
        if not self.slug:
            raise ValidationError({"slug": "Enter a slug."})
        self.full_clean()
        store_optimized_image(self, "cover_image")
        super().save(*args, **kwargs)


class BlogImage(models.Model):
    """Uploaded illustration for use inside an article. Copy its public URL into the article HTML."""

    image = models.ImageField(upload_to="blogs/inline/")
    alt_text = models.CharField(max_length=180)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "blog_images"
        ordering = ["-created_at"]
        verbose_name = "Blog image"
        verbose_name_plural = "Blog images"

    def __str__(self):
        return self.alt_text

    def save(self, *args, **kwargs):
        store_optimized_image(self, "image")
        super().save(*args, **kwargs)


class BlogSubscriber(models.Model):
    email = models.EmailField(unique=True)
    consent = models.BooleanField(default=False)
    consented_at = models.DateTimeField()
    source = models.CharField(max_length=40, default="blog")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "blog_subscribers"
        ordering = ["-created_at"]

    def __str__(self):
        return self.email
