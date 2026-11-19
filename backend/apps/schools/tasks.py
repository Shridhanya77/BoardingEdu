from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .engagement import recalculate_school_popularity
from .models import SchoolEngagement, SchoolPopularityConfig


@shared_task
def refresh_school_popularity():
    now = timezone.now()
    school_count = recalculate_school_popularity(now=now)
    config, _ = SchoolPopularityConfig.objects.get_or_create(config_id=1)
    deleted_events, _ = SchoolEngagement.objects.filter(
        occurred_at__lt=now - timedelta(days=config.rolling_window_days),
    ).delete()
    return {"schools_updated": school_count, "expired_events_removed": deleted_events}
