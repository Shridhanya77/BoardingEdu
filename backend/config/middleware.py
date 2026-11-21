"""Middleware that publishes due draft blog posts on incoming requests.

Celery beat flips scheduled drafts to Published every minute when a worker is
running, but the production web service (gunicorn) does not run beat by
default. This middleware acts as a safety net: on every request it checks, at
most once per ``PUBLISH_INTERVAL_SECONDS``, whether any draft article has a
``published_at`` in the past and publishes it.

This means the admin status field stays in sync with what the public site
shows (the ``BlogPostQuerySet.published()`` filter already treats due drafts
as public), regardless of whether Celery beat is running.
"""

import logging
import time

from apps.blogs.tasks import publish_scheduled_posts

logger = logging.getLogger(__name__)

# How often (in seconds) the publish check actually runs. The Celery beat
# schedule runs every minute, so 60s keeps the two mechanisms in sync and
# avoids hammering the database on every request.
PUBLISH_INTERVAL_SECONDS = 60

_last_publish_run = 0.0


class PublishScheduledPostsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        global _last_publish_run
        now = time.monotonic()
        if now - _last_publish_run >= PUBLISH_INTERVAL_SECONDS:
            _last_publish_run = now
            try:
                publish_scheduled_posts()
            except Exception:
                logger.exception("publish_scheduled_posts failed in middleware")
        return self.get_response(request)
