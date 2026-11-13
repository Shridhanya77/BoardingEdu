from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator


class GuideCategory(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    status = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "guide_categories"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Guide categories"

    def __str__(self):
        return self.name


class GuideArticle(models.Model):
    slug = models.SlugField(max_length=180, primary_key=True)
    title = models.CharField(max_length=240)
    summary = models.TextField()
    cover_image_url = models.URLField(max_length=500, blank=True)
    category = models.ForeignKey(
        GuideCategory,
        on_delete=models.PROTECT,
        related_name="articles",
    )
    updated_on = models.DateField()
    reading_minutes = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)],
    )
    sections = models.JSONField(default=list)
    sort_order = models.PositiveSmallIntegerField(default=0)
    status = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "guide_articles"
        ordering = ["sort_order", "title"]

    def clean(self):
        super().clean()
        if not isinstance(self.sections, list):
            raise ValidationError({"sections": "Sections must be a list of headings and paragraphs."})
        for index, section in enumerate(self.sections):
            if not isinstance(section, dict):
                raise ValidationError({"sections": f"Section {index + 1} must be an object."})
            heading = section.get("heading")
            body = section.get("body")
            if not isinstance(heading, str) or not heading.strip():
                raise ValidationError({"sections": f"Section {index + 1} needs a heading."})
            if not isinstance(body, list) or not body or any(
                not isinstance(paragraph, str) or not paragraph.strip()
                for paragraph in body
            ):
                raise ValidationError({
                    "sections": f"Section {index + 1} needs one or more non-empty paragraphs."
                })

    def __str__(self):
        return self.title
