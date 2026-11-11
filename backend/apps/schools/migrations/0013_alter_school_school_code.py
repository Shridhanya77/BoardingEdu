from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("schools", "0012_school_about_school_admission_open_school_tagline_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="school",
            name="school_code",
            field=models.CharField(max_length=64, unique=True),
        ),
    ]
