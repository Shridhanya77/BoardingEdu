from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0006_counsellingrequest_preferred_states"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="counsellingrequest",
            name="assigned_to",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_counselling_requests",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="counsellingrequest",
            name="next_followup_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="counsellingrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("NEW", "New"),
                    ("ASSIGNED", "Assigned"),
                    ("APPROVED", "Approved"),
                    ("CONTACTED", "Contacted"),
                    ("CALL_BACK", "Call Back Scheduled"),
                    ("CONVERTED", "Converted"),
                    ("REJECTED", "Rejected"),
                    ("CLOSED", "Closed"),
                ],
                db_index=True,
                default="NEW",
                max_length=12,
            ),
        ),
    ]
