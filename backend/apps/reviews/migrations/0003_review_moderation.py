import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def publish_as_approved(apps, schema_editor):
    Review = apps.get_model("reviews", "Review")
    Review.objects.filter(status="PUBLISHED").update(status="APPROVED")


def unpublish_as_published(apps, schema_editor):
    Review = apps.get_model("reviews", "Review")
    Review.objects.filter(status="APPROVED").update(status="PUBLISHED")


class Migration(migrations.Migration):

    dependencies = [
        ("reviews", "0002_review_academics_rating_review_communication_rating_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="moderated_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="review",
            name="moderated_by",
            field=models.ForeignKey(
                blank=True,
                editable=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="moderated_reviews",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(publish_as_approved, unpublish_as_published),
        migrations.AlterField(
            model_name="review",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending Moderation"),
                    ("APPROVED", "Approved"),
                    ("REJECTED", "Rejected"),
                ],
                db_index=True,
                default="PENDING",
                max_length=20,
            ),
        ),
    ]
