"""
BoardingEdu Django project config package.

Exposes the Celery app so the following worker command works from
the `backend/` directory without additional configuration:

    celery -A config worker --loglevel=info
    celery -A config beat   --loglevel=info
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
