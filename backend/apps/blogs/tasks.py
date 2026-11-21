"""Celery tasks for the blogs app."""

import logging

from celery import shared_task
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import BlogPost

logger = logging.getLogger(__name__)


@shared_task
def publish_scheduled_posts():
    """Flip due draft articles to Published.

    Finds every ``draft`` article whose ``published_at`` has passed and sets
    its status to ``published`` so the admin reflects reality. Public visibility
    is already granted by ``BlogPostQuerySet.published()`` (which treats due
    drafts as public); this task keeps the status field consistent.

    Articles that fail validation (e.g. missing cover image) are skipped and
    logged so they remain drafts until the editor fixes them.

    Returns a dict with counts of published and failed articles.
    """
    now = timezone.now()
    due = BlogPost.objects.filter(
        status=BlogPost.STATUS_DRAFT,
        published_at__isnull=False,
        published_at__lte=now,
    )
    published = 0
    failed = 0
    for post in due:
        post.status = BlogPost.STATUS_PUBLISHED
        try:
            post.save()
        except ValidationError as exc:
            failed += 1
            logger.warning(
                "Scheduled publish skipped for %r (pk=%s): %s",
                post.title,
                post.pk,
                exc.messages if getattr(exc, "messages", None) else exc,
            )
            continue
        published += 1
    if published or failed:
        logger.info("publish_scheduled_posts: published=%s failed=%s", published, failed)
    return {"published": published, "failed": failed}
