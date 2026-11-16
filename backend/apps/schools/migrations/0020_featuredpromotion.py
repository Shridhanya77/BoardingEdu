import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("schools", "0019_school_student_teacher_ratio"),
    ]

    operations = [
        migrations.CreateModel(
            name="FeaturedPromotion",
            fields=[
                (
                    "promotion_id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "banner_url",
                    models.URLField(
                        blank=True,
                        help_text="Promotional image. Leave blank to use the school's cover image.",
                        max_length=500,
                    ),
                ),
                (
                    "description",
                    models.CharField(
                        blank=True,
                        help_text="Short line shown on the homepage and listing banners.",
                        max_length=280,
                    ),
                ),
                (
                    "highlights",
                    models.TextField(
                        blank=True,
                        help_text="One facility or highlight per line. Up to four are shown.",
                    ),
                ),
                (
                    "label",
                    models.CharField(
                        choices=[("FEATURED", "Featured"), ("SPONSORED", "Sponsored")],
                        default="FEATURED",
                        max_length=20,
                    ),
                ),
                (
                    "priority",
                    models.PositiveIntegerField(
                        db_index=True,
                        default=0,
                        help_text="Higher numbers are shown first.",
                    ),
                ),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("starts_on", models.DateField(blank=True, null=True)),
                ("ends_on", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "school",
                    models.OneToOneField(
                        db_column="school_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="featured_promotion",
                        to="schools.school",
                    ),
                ),
            ],
            options={
                "verbose_name": "Featured promotion",
                "verbose_name_plural": "Featured promotions",
                "db_table": "featured_promotions",
                "ordering": ["-priority", "school__school_name"],
            },
        ),
    ]
