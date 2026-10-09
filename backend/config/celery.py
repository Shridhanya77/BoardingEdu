"""
Celery app configuration for BoardingEdu.

Usage:
  Worker: celery -A config worker --loglevel=info
  Beat:   celery -A config beat --loglevel=info

Uses the REDIS_URL from Django settings as both broker and result backend.
Tasks in any Django app are auto-discovered under `apps.<app>.tasks`.
"""

import os

from celery import Celery
from django.conf import settings

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")

# Read celery-related configuration keys from Django settings with CELERY_ prefix.
# Example: CELERY_ACCEPT_CONTENT in settings.py → accept_content in Celery.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django apps.
# Each app can define a `tasks.py` (or package) decorated with @app.task.
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Healthcheck task: prints the Celery request to stdout."""
    print(f"Celery debug_task request: {self.request!r}")
