"""Management command: publish scheduled (due) draft articles.

Useful as a cron fallback when Celery beat is not running:

    python manage.py publish_scheduled_posts

Delegates to the shared Celery task so behaviour is identical whether invoked
by beat, by this command, or directly.
"""

from django.core.management.base import BaseCommand

from apps.blogs.tasks import publish_scheduled_posts


class Command(BaseCommand):
    help = "Publish draft articles whose scheduled published_at has passed."

    def handle(self, *args, **options):
        result = publish_scheduled_posts()
        self.stdout.write(
            self.style.SUCCESS(
                f"Published {result['published']} article(s); "
                f"{result['failed']} skipped due to validation errors."
            )
        )
