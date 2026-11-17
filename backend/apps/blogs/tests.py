from datetime import timedelta
from io import BytesIO

from botocore.exceptions import ClientError
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.storage import InMemoryStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from .html import sanitize_blog_html
from .models import BlogCategory, BlogPost, BlogSubscriber


class BrokenCloudStorage(InMemoryStorage):
    def _save(self, name, content):
        raise ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "denied"}},
            "PutObject",
        )


def tiny_png(name="cover.png"):
    buffer = BytesIO()
    Image.new("RGB", (12, 12), (11, 95, 138)).save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class BlogHtmlTests(TestCase):
    def test_script_and_unsafe_urls_are_removed_and_headings_get_ids(self):
        article = sanitize_blog_html(
            "<h2>Choosing a <strong>school</strong></h2>"
            "<script>alert('x')</script>"
            "<p>Visit <a href=\"javascript:alert(1)\">bad</a> "
            "and <a href=\"https://www.boardingedu.com/india/\">schools</a>.</p>"
            "<img src=\"https://cdn.example.com/photo.webp\" alt=\"Library shelves\" "
            "onerror=\"alert(1)\">"
        )

        self.assertNotIn("script", article.html.lower())
        self.assertNotIn("javascript:", article.html.lower())
        self.assertNotIn("onerror", article.html.lower())
        self.assertIn('id="choosing-a-school"', article.html)
        self.assertIn('alt="Library shelves"', article.html)
        self.assertIn('rel="noopener noreferrer"', article.html)
        self.assertEqual(article.headings[0]["text"], "Choosing a school")

        again = sanitize_blog_html(article.html)
        self.assertEqual(again.html, article.html)
        self.assertEqual(again.headings, article.headings)


@override_settings(
    BREVO_API_KEY="",
    BREVO_BLOG_LIST_ID="",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    },
)
class PublicBlogApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = BlogCategory.objects.create(
            name="Admissions Lab",
            slug="admissions-lab",
            description="Admission planning notes.",
            display_order=30,
        )
        self.hidden_category = BlogCategory.objects.create(
            name="Hidden",
            slug="hidden-category",
            is_active=False,
        )
        self.published = BlogPost.objects.create(
            title="How families compare admission timelines",
            slug="admission-timelines",
            category=self.category,
            short_description="A practical look at admission dates.",
            content="<h2>Start early</h2><p>Ask for the current admission calendar.</p>",
            cover_image=tiny_png(),
            author_name="BoardingEdu Editorial",
            featured=True,
            status=BlogPost.STATUS_PUBLISHED,
        )
        BlogPost.objects.create(
            title="Draft admission notes",
            slug="draft-notes",
            category=self.category,
            short_description="Not ready.",
            content="<p>Secret draft</p><script>alert(1)</script>",
            status=BlogPost.STATUS_DRAFT,
        )
        BlogPost.objects.create(
            title="Archived note",
            slug="archived-note",
            category=self.category,
            short_description="Old note.",
            content="<p>Archived</p>",
            cover_image=tiny_png("old.png"),
            status=BlogPost.STATUS_ARCHIVED,
        )
        self.scheduled = BlogPost.objects.create(
            title="Scheduled note",
            slug="scheduled-note",
            category=self.category,
            short_description="Coming later.",
            content="<p>Later</p>",
            cover_image=tiny_png("later.png"),
            status=BlogPost.STATUS_PUBLISHED,
            published_at=timezone.now() + timedelta(days=2),
        )
        BlogPost.objects.create(
            title="Hidden category note",
            slug="hidden-category-note",
            category=self.hidden_category,
            short_description="Inactive category.",
            content="<p>Hidden</p>",
            cover_image=tiny_png("hidden.png"),
            status=BlogPost.STATUS_PUBLISHED,
        )

    def test_public_lists_hide_private_articles(self):
        response = self.client.get("/api/blogs/")
        self.assertEqual(response.status_code, 200)
        slugs = {row["slug"] for row in response.data["results"]}
        self.assertEqual(slugs, {"admission-timelines"})
        self.assertTrue(response.data["results"][0]["cover_image_url"].endswith(".webp"))
        self.assertEqual(response.data["results"][0]["reading_time_minutes"], 1)

        featured = self.client.get("/api/blogs/featured/")
        self.assertEqual([row["slug"] for row in featured.data["results"]], ["admission-timelines"])
        latest = self.client.get("/api/blogs/latest/")
        self.assertEqual(latest.data["results"][0]["slug"], "admission-timelines")

    def test_detail_search_and_category_filters(self):
        detail = self.client.get("/api/blogs/admission-timelines/")
        self.assertEqual(detail.status_code, 200)
        self.assertIn("Start early", detail.data["content"])
        self.assertNotIn("<script", detail.data["content"])
        self.assertEqual(detail.data["headings"][0]["id"], "start-early")
        self.assertEqual(detail.data["meta_title"], "How families compare admission timelines")

        missing = self.client.get("/api/blogs/draft-notes/")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(self.client.get("/api/blogs/does-not-exist/").status_code, 404)

        search = self.client.get("/api/blogs/search/", {"q": "calendar"})
        self.assertEqual(search.status_code, 200)
        self.assertEqual(search.data["results"][0]["slug"], "admission-timelines")
        self.assertEqual(self.client.get("/api/blogs/search/", {"q": "a"}).status_code, 400)

        category = self.client.get("/api/blogs/category/admissions-lab/")
        self.assertEqual(category.status_code, 200)
        self.assertEqual(category.data["results"][0]["slug"], "admission-timelines")
        self.assertEqual(self.client.get("/api/blogs/category/missing/").status_code, 404)
        self.assertEqual(self.client.get("/api/blogs/category/hidden-category/").status_code, 404)

        categories = self.client.get("/api/blog-categories/")
        names = {row["name"] for row in categories.data["results"]}
        self.assertIn("Admissions Lab", names)
        self.assertNotIn("Hidden", names)

    def test_preview_is_limited_to_platform_admins(self):
        user_model = get_user_model()
        self.assertEqual(self.client.get("/api/blogs/preview/draft-notes/").status_code, 401)

        parent = user_model.objects.create_user(
            username="blog-parent",
            email="blog-parent@example.test",
            password="secret-pass",
            role=user_model.ROLE_PARENT,
        )
        parent_client = APIClient()
        parent_client.force_authenticate(parent)
        self.assertEqual(parent_client.get("/api/blogs/preview/draft-notes/").status_code, 403)

        school_admin = user_model.objects.create_user(
            username="blog-school",
            email="blog-school@example.test",
            password="secret-pass",
            role=user_model.ROLE_SCHOOL_ADMIN,
            is_staff=True,
        )
        school_client = APIClient()
        school_client.force_authenticate(school_admin)
        self.assertEqual(school_client.get("/api/blogs/preview/draft-notes/").status_code, 403)

        staff = user_model.objects.create_user(
            username="blog-staff",
            email="blog-staff@example.test",
            password="secret-pass",
            role=user_model.ROLE_STAFF_ADMIN,
            is_staff=True,
        )
        staff_client = APIClient()
        staff_client.force_authenticate(staff)
        preview = staff_client.get("/api/blogs/preview/draft-notes/")
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["status"], "draft")
        self.assertNotIn("script", preview.data["content"].lower())
        self.assertNotIn("Secret draft", self.client.get("/api/blogs/").content.decode())

    def test_subscription_requires_consent_and_rejects_duplicates(self):
        denied = self.client.post("/api/blogs/subscribe/", {"email": "parent@example.test", "consent": False}, format="json")
        self.assertEqual(denied.status_code, 400)

        created = self.client.post(
            "/api/blogs/subscribe/",
            {"email": "Parent@Example.test", "consent": True},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertFalse(created.data["already_subscribed"])
        self.assertEqual(BlogSubscriber.objects.get().email, "parent@example.test")

        duplicate = self.client.post(
            "/api/blogs/subscribe/",
            {"email": "parent@example.test", "consent": True},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 200)
        self.assertTrue(duplicate.data["already_subscribed"])
        self.assertEqual(BlogSubscriber.objects.count(), 1)

    def test_reserved_slug_and_publish_rules(self):
        with self.assertRaises(ValidationError):
            BlogPost.objects.create(
                title="Preview",
                slug="preview",
                category=self.category,
                short_description="Reserved.",
                content="<p>Text</p>",
                status=BlogPost.STATUS_DRAFT,
            )
        with self.assertRaises(ValidationError):
            BlogPost.objects.create(
                title="Needs a cover",
                slug="needs-a-cover",
                category=self.category,
                short_description="Missing image.",
                content="<p>Text</p>",
                status=BlogPost.STATUS_PUBLISHED,
            )

    def test_staff_admin_can_open_blog_admin_and_school_staff_cannot(self):
        user_model = get_user_model()
        school_admin = user_model.objects.create_user(
            username="blog-admin-school",
            email="blog-admin-school@example.test",
            password="secret-pass",
            role=user_model.ROLE_SCHOOL_ADMIN,
            is_staff=True,
        )
        school_client = APIClient()
        school_client.force_login(school_admin)
        denied = school_client.get("/admin/blogs/blogpost/")
        self.assertNotEqual(denied.status_code, 200)
        followed = school_client.get("/admin/blogs/blogpost/", follow=True)
        self.assertNotContains(followed, "Select blog post to change")

        staff = user_model.objects.create_user(
            username="blog-admin-staff",
            email="blog-admin-staff@example.test",
            password="secret-pass",
            role=user_model.ROLE_STAFF_ADMIN,
            is_staff=True,
        )
        staff_client = APIClient()
        staff_client.force_login(staff)
        self.assertEqual(staff_client.get("/admin/blogs/blogpost/").status_code, 200)
        self.assertEqual(staff_client.get("/admin/blogs/blogcategory/").status_code, 200)

    def test_saving_a_published_article_in_admin_does_not_crash(self):
        user_model = get_user_model()
        admin_user = user_model.objects.create_superuser(
            username="blog-save-admin",
            email="blog-save-admin@example.test",
            password="secret-pass",
        )
        admin_user.role = user_model.ROLE_SUPER_ADMIN
        admin_user.save(update_fields=["role"])
        client = APIClient()
        client.force_login(admin_user)
        url = reverse("admin:blogs_blogpost_change", args=[self.published.pk])
        published_at = self.published.published_at
        response = client.post(
            url,
            {
                "title": self.published.title,
                "slug": self.published.slug,
                "category": self.category.pk,
                "short_description": self.published.short_description,
                "content": self.published.content,
                "author_name": self.published.author_name,
                "status": BlogPost.STATUS_PUBLISHED,
                "published_at_0": published_at.date().isoformat(),
                "published_at_1": published_at.strftime("%H:%M:%S"),
            },
        )
        self.assertNotEqual(response.status_code, 500)
        self.assertEqual(response.status_code, 302)

        upload = client.post(
            url,
            {
                "title": self.published.title,
                "slug": self.published.slug,
                "category": self.category.pk,
                "short_description": self.published.short_description,
                "content": "<h2>Updated</h2><p>Visible article text.</p>",
                "author_name": self.published.author_name,
                "status": BlogPost.STATUS_PUBLISHED,
                "published_at_0": published_at.date().isoformat(),
                "published_at_1": published_at.strftime("%H:%M:%S"),
                "cover_image": tiny_png("replacement.png"),
            },
        )
        self.assertNotEqual(upload.status_code, 500, getattr(upload, "content", b"")[:500])
        self.assertEqual(upload.status_code, 302)
        self.published.refresh_from_db()
        self.assertTrue(self.published.cover_image.name.endswith(".webp"))
        self.assertIn("Updated", self.published.content)

    def test_storage_failure_and_empty_article_stay_on_the_form(self):
        user_model = get_user_model()
        admin_user = user_model.objects.create_superuser(
            username="blog-error-admin",
            email="blog-error-admin@example.test",
            password="secret-pass",
        )
        admin_user.role = user_model.ROLE_SUPER_ADMIN
        admin_user.save(update_fields=["role"])
        client = APIClient()
        client.force_login(admin_user)
        url = reverse("admin:blogs_blogpost_change", args=[self.published.pk])
        published_at = self.published.published_at
        payload = {
            "title": self.published.title,
            "slug": self.published.slug,
            "category": self.category.pk,
            "short_description": self.published.short_description,
            "content": "<script>alert(1)</script>",
            "author_name": self.published.author_name,
            "status": BlogPost.STATUS_PUBLISHED,
            "published_at_0": published_at.date().isoformat(),
            "published_at_1": published_at.strftime("%H:%M:%S"),
        }
        empty_article = client.post(url, payload)
        self.assertEqual(empty_article.status_code, 200)
        self.assertContains(empty_article, "Published articles need article text.")

        with override_settings(
            STORAGES={
                "default": {"BACKEND": "apps.blogs.tests.BrokenCloudStorage"},
                "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
            }
        ):
            failed_upload = client.post(url, {**payload, "content": self.published.content, "cover_image": tiny_png("broken.png")})
        self.assertEqual(failed_upload.status_code, 200)
        self.assertContains(failed_upload, "could not be stored in Cloudflare")
