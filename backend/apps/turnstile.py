import os
import sys
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import json

from django.conf import settings
from rest_framework.exceptions import ValidationError


TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_turnstile(request) -> None:
    if getattr(settings, "DEBUG", False) or "test" in sys.argv:
        return

    secret_key = getattr(settings, "TURNSTILE_SECRET_KEY", "")
    if not secret_key:
        raise ValidationError({
            "cf_turnstile_token": "Bot protection is not configured. Contact the administrator.",
        })

    data = getattr(request, "data", {}) or {}
    token = data.get("cf_turnstile_token") or request.headers.get("CF-Turnstile-Token")
    if not isinstance(token, str) or not token.strip():
        raise ValidationError({
            "cf_turnstile_token": "Complete the Cloudflare verification before continuing.",
        })

    remote_ip = request.META.get("HTTP_CF_CONNECTING_IP") or request.META.get("REMOTE_ADDR")
    payload = {"secret": secret_key, "response": token.strip()}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        req = Request(
            TURNSTILE_VERIFY_URL,
            data=urlencode(payload).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
    except Exception:
        raise ValidationError({
            "cf_turnstile_token": "Bot verification is temporarily unavailable. Please try again.",
        })

    if not result.get("success"):
        raise ValidationError({
            "cf_turnstile_token": "Cloudflare verification failed. Please complete it again.",
        })
