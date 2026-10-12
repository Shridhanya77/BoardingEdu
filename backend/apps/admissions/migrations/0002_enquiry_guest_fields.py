from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('admissions', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='admissionenquiry',
            name='enquiry_code',
            field=models.CharField(blank=True, max_length=30, unique=True),
        ),
        migrations.AlterField(
            model_name='admissionenquiry',
            name='message',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='admissionenquiry',
            name='guest_full_name',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='admissionenquiry',
            name='guest_email',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name='admissionenquiry',
            name='guest_phone',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='admissionenquiry',
            name='guest_child_name',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='admissionenquiry',
            name='guest_child_dob',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='admissionenquiry',
            name='guest_child_gender',
            field=models.CharField(blank=True, max_length=10),
        ),
    ]
