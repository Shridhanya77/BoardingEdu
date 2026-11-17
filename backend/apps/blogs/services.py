"""Best-effort Brevo contact sync for blog newsletter subscribers.

Local subscription succeeds even when Brevo is not configured. SMTP-only Brevo
keys cannot manage contacts, so those are skipped.
"""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def sync_blog_subscriber(email):
    api_key = getattr(settings, "BREVO_API_KEY", "")
    if not api_key or api_key.startswith("xsmtpsib-"):
        return False
    payload = {
        "email": email,
        "updateEnabled": True,
        "attributes": {"SOURCE": "BoardingEdu blogs"},
    }
    list_id = str(getattr(settings, "BREVO_BLOG_LIST_ID", "") or "").strip()
    if list_id.isdigit():
        payload["listIds"] = [int(list_id)]
    try:
        response = requests.post(
            "https://api.brevo.com/v3/contacts",
            headers={"api-key": api_key, "Content-Type": "application/json", "accept": "application/json"},
            json=payload,
            timeout=(3.05, 8),
        )
    except requests.RequestException:
        logger.warning("Brevo blog contact sync failed for a subscriber.")
        return False
    if response.status_code in {201, 204}:
        return True
    if response.status_code == 400 and "duplicate" in response.text.lower():
        return True
    logger.warning("Brevo blog contact sync was not accepted (status %s).", response.status_code)
    return False
