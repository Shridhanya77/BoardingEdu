"""Send saved-search and shortlist admission-opening alert emails.

Run on a schedule (Celery beat uses the same code path, or trigger from cron):

    python manage.py send_saved_search_alerts
"""
from django.core.management.base import BaseCommand

from apps.notifications.matching import run_saved_search_alerts


class Command(BaseCommand):
    help = "Send pending saved-search and shortlist admission-opening alert emails."

    def handle(self, *args, **options):
        summary = run_saved_search_alerts()
        self.stdout.write(self.style.SUCCESS(f"Saved-search alerts: {summary}"))
