import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count, Q


class ReviewQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=Review.STATUS_PUBLISHED)

    def for_school(self, school):
        return self.filter(school=school)

    def with_stats(self):
        return self.aggregate(
            average_rating=Avg("rating"),
            review_count=Count("review_id"),
        )


class Review(models.Model):
    """A parent's rating + written review for a specific school."""

    STATUS_PENDING = "PENDING"
    STATUS_PUBLISHED = "PUBLISHED"
    STATUS_REJECTED = "REJECTED"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending Moderation"),
        (STATUS_PUBLISHED, "Published"),
        (STATUS_REJECTED, "Rejected"),
    ]

    review_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="reviews",
        db_column="school_id",
        null=False,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="reviews",
        db_column="user_id",
        null=True,
        blank=True,
    )
    author_name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Display name shown publicly (defaults to the reviewer's name).",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Star rating from 1 (poor) to 5 (excellent).",
    )
    academics_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Optional parent rating for academics and teaching.",
    )
    facilities_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Optional parent rating for facilities and campus.",
    )
    safety_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Optional parent rating for safety and wellbeing.",
    )
    communication_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Optional parent rating for communication and admissions.",
    )
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="Marks reviews from verified parents/admission enquiries.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ReviewQuerySet.as_manager()

    class Meta:
        db_table = "reviews"
        ordering = ["-created_at"]
        verbose_name = "Review"
        verbose_name_plural = "Reviews"
        constraints = [
            models.UniqueConstraint(
                fields=["school", "user"],
                condition=Q(user__isnull=False),
                name="uq_review_school_user",
            ),
            models.CheckConstraint(
                check=Q(rating__gte=1) & Q(rating__lte=5),
                name="ck_review_rating_range",
            ),
        ]
        indexes = [
            models.Index(fields=["school", "status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.rating}★ — {self.school.school_name}"

    @property
    def display_name(self):
        if self.author_name:
            return self.author_name
        if self.user_id:
            full_name = self.user.get_full_name()
            return full_name or self.user.username
        return "Anonymous"
