# Generated for the school verification audit trail.
import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("schools", "0010_schoolfaq"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SchoolVerificationEvent",
            fields=[
                (
                    "event_id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "previous_status",
                    models.CharField(
                        choices=[
                            ("UNVERIFIED", "Unverified"),
                            ("PENDING", "Pending Verification"),
                            ("VERIFIED", "Verified"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "new_status",
                    models.CharField(
                        choices=[
                            ("UNVERIFIED", "Unverified"),
                            ("PENDING", "Pending Verification"),
                            ("VERIFIED", "Verified"),
                        ],
                        max_length=20,
                    ),
                ),
                ("note", models.TextField(max_length=1000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="school_verification_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        db_column="school_id",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="verification_events",
                        to="schools.school",
                    ),
                ),
            ],
            options={
                "db_table": "school_verification_events",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="schoolverificationevent",
            index=models.Index(
                fields=["school", "created_at"],
                name="sch_ver_ev_sch_created_idx",
            ),
        ),
    ]
