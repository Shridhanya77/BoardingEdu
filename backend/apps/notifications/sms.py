"""Optional SMS hook for application updates.

Messages are sent only when SMS_API_URL and SMS_API_KEY are configured.
Otherwise the call is recorded as skipped and the in-dashboard notice still stands.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def queue_application_sms(phone, message):
    url = getattr(settings, "SMS_API_URL", "") or ""
    key = getattr(settings, "SMS_API_KEY", "") or ""
    if not phone or not url or not key:
        logger.info("SMS notification skipped because no SMS provider is configured.")
        return
    try:
        requests.post(
            url,
            json={"to": phone, "message": message[:320]},
            headers={"Authorization": f"Bearer {key}"},
            timeout=5,
        )
    except requests.RequestException:
        logger.warning("SMS notification could not be delivered.")
