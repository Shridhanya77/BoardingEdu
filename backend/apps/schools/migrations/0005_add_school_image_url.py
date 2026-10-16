from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0004_add_school_logo_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='school',
            name='school_image_url',
            field=models.URLField(blank=True, max_length=500),
        ),
    ]
