"""
BoardingEdu Django project config package.

Exposes the Celery app so the following worker command works from
the `backend/` directory without additional configuration:

    celery -A config worker --loglevel=info
    celery -A config beat   --loglevel=info
"""

__all__ = ("celery_app",)


def __getattr__(name):
    # Celery is only needed for workers. Importing it here used to stop
    # manage.py whenever the celery package was not installed.
    if name == "celery_app":
        from .celery import app as celery_app
        return celery_app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
