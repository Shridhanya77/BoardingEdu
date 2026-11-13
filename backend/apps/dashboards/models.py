import uuid

from django.db import models
from django.utils import timezone


class RecentSchoolView(models.Model):
    recent_view_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent_profile = models.ForeignKey(
        "users.ParentProfile",
        on_delete=models.CASCADE,
        related_name="recent_school_views",
    )
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="parent_recent_views",
    )
    last_viewed_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "parent_recent_school_views"
        ordering = ["-last_viewed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["parent_profile", "school"],
                name="uq_parent_recent_school_view",
            ),
        ]
        indexes = [
            models.Index(fields=["parent_profile", "-last_viewed_at"]),
        ]
