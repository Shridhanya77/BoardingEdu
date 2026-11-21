from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("schools", "0026_schoolengagement_sch_eng_time_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="school",
            name="seo_title",
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name="school",
            name="seo_description",
            field=models.TextField(blank=True, max_length=10000),
        ),
    ]
