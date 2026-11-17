import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BlogCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80, unique=True)),
                ("slug", models.SlugField(max_length=90, unique=True)),
                ("description", models.TextField(blank=True)),
                ("image", models.ImageField(blank=True, upload_to="blogs/categories/")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("display_order", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Blog category",
                "verbose_name_plural": "Blog categories",
                "db_table": "blog_categories",
                "ordering": ["display_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="BlogSubscriber",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("consent", models.BooleanField(default=False)),
                ("consented_at", models.DateTimeField()),
                ("source", models.CharField(default="blog", max_length=40)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "blog_subscribers",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="BlogImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="blogs/inline/")),
                ("alt_text", models.CharField(max_length=180)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Blog image",
                "verbose_name_plural": "Blog images",
                "db_table": "blog_images",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="BlogPost",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=220)),
                ("slug", models.SlugField(max_length=220, unique=True)),
                ("short_description", models.TextField(validators=[django.core.validators.MaxLengthValidator(400)])),
                ("content", models.TextField(blank=True)),
                ("cover_image", models.ImageField(blank=True, upload_to="blogs/covers/")),
                ("author_name", models.CharField(default="BoardingEdu Editorial", max_length=120)),
                ("featured", models.BooleanField(db_index=True, default=False)),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Draft"), ("published", "Published"), ("archived", "Archived")],
                        db_index=True,
                        default="draft",
                        max_length=12,
                    ),
                ),
                ("meta_title", models.CharField(blank=True, max_length=180)),
                ("meta_description", models.CharField(blank=True, max_length=320)),
                ("canonical_url", models.URLField(blank=True, max_length=500)),
                ("reading_time_minutes", models.PositiveSmallIntegerField(default=0, editable=False)),
                (
                    "published_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="Leave blank to publish immediately. A future date hides the article until then.",
                        null=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "author",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="blog_posts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="posts",
                        to="blogs.blogcategory",
                    ),
                ),
            ],
            options={
                "db_table": "blog_posts",
                "ordering": ["-published_at", "-created_at"],
                "indexes": [
                    models.Index(fields=["status", "published_at"], name="blog_post_status_published"),
                    models.Index(fields=["featured", "status"], name="blog_post_featured_status"),
                ],
            },
        ),
    ]
