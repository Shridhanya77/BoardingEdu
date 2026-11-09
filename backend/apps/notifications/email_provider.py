import requests
from django.conf import settings


class EmailDeliveryError(Exception):
    def __init__(self, error_code):
        self.error_code = error_code
        super().__init__(error_code)


class ResendEmailProvider:
    endpoint = "https://api.resend.com/emails"

    def send(self, *, recipient, subject, text, html, idempotency_key):
        if not settings.RESEND_API_KEY or not settings.DEFAULT_FROM_EMAIL:
            raise EmailDeliveryError("email_not_configured")

        try:
            response = requests.post(
                self.endpoint,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotency_key,
                },
                json={
                    "from": settings.DEFAULT_FROM_EMAIL,
                    "to": [recipient],
                    "subject": subject,
                    "text": text,
                    "html": html,
                },
                timeout=(3.05, 10),
            )
        except requests.Timeout as exc:
            raise EmailDeliveryError("provider_timeout") from exc
        except requests.RequestException as exc:
            raise EmailDeliveryError("provider_connection_error") from exc

        if response.status_code >= 500 or response.status_code == 429:
            raise EmailDeliveryError("provider_temporary_error")
        if not response.ok:
            raise EmailDeliveryError("provider_rejected")

        try:
            result = response.json()
        except ValueError as exc:
            raise EmailDeliveryError("provider_invalid_response") from exc
        if not isinstance(result, dict) or not result.get("id"):
            raise EmailDeliveryError("provider_invalid_response")
        return result["id"]


def get_email_provider():
    if settings.EMAIL_PROVIDER == "resend":
        return ResendEmailProvider()
    raise EmailDeliveryError("email_provider_not_supported")
