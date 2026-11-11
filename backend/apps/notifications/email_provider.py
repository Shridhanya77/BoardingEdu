import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


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
            logger.error("Resend temporary error status=%s body=%s", response.status_code, response.text[:500])
            raise EmailDeliveryError("provider_temporary_error")
        if not response.ok:
            logger.error("Resend rejected status=%s body=%s", response.status_code, response.text[:500])
            raise EmailDeliveryError("provider_rejected")

        try:
            result = response.json()
        except ValueError as exc:
            raise EmailDeliveryError("provider_invalid_response") from exc
        if not isinstance(result, dict) or not result.get("id"):
            raise EmailDeliveryError("provider_invalid_response")
        return result["id"]


class CloudflareEmailProvider:
    """Outbound mail through Cloudflare Email Service, not Email Routing.

    A send is successful only when Cloudflare accepts the recipient into
    `delivered` or `queued`. The message body is never written to logs.
    """

    def send(self, *, recipient, subject, text, html, idempotency_key):
        token = settings.CLOUDFLARE_EMAIL_API_TOKEN
        account_id = settings.CLOUDFLARE_EMAIL_ACCOUNT_ID
        sender = settings.CLOUDFLARE_EMAIL_FROM or settings.DEFAULT_FROM_EMAIL
        if not token or not account_id or not sender:
            raise EmailDeliveryError("email_not_configured")
        try:
            response = requests.post(
                f"https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "to": [recipient],
                    "from": sender,
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
        try:
            payload = response.json()
        except ValueError as exc:
            raise EmailDeliveryError("provider_invalid_response") from exc
        if response.status_code in {401, 403} or response.status_code >= 500 or response.status_code == 429:
            raise EmailDeliveryError("provider_rejected")
        if not response.ok or not isinstance(payload, dict) or not payload.get("success"):
            raise EmailDeliveryError("provider_rejected")
        result = payload.get("result") or {}
        delivered = set(result.get("delivered") or [])
        queued = set(result.get("queued") or [])
        if recipient not in delivered and recipient not in queued:
            raise EmailDeliveryError("provider_rejected")
        return result.get("message_id") or idempotency_key


class BrevoEmailProvider:
    endpoint = "https://api.brevo.com/v3/smtp/email"

    def send(self, *, recipient, subject, text, html, idempotency_key):
        api_key = getattr(settings, "BREVO_API_KEY", "")
        sender = getattr(settings, "BREVO_SENDER_EMAIL", "")
        if not api_key or not sender:
            raise EmailDeliveryError("email_not_configured")
        if api_key.startswith("xsmtpsib-"):
            return self._send_smtp(api_key, sender, recipient, subject, text, html)
        try:
            response = requests.post(
                self.endpoint,
                headers={"api-key": api_key, "Content-Type": "application/json"},
                json={
                    "sender": {
                        "email": sender,
                        "name": getattr(settings, "BREVO_SENDER_NAME", "") or "BoardingEdu",
                    },
                    "to": [{"email": recipient}],
                    "subject": subject,
                    "textContent": text,
                    "htmlContent": html,
                },
                timeout=(3.05, 10),
            )
        except requests.Timeout as exc:
            raise EmailDeliveryError("provider_timeout") from exc
        except requests.RequestException as exc:
            raise EmailDeliveryError("provider_connection_error") from exc
        if response.status_code >= 500 or response.status_code == 429:
            logger.error("Brevo temporary error status=%s body=%s", response.status_code, response.text[:500])
            raise EmailDeliveryError("provider_temporary_error")
        if not response.ok:
            logger.error("Brevo rejected status=%s body=%s", response.status_code, response.text[:500])
            raise EmailDeliveryError("provider_rejected")
        try:
            result = response.json()
        except ValueError as exc:
            raise EmailDeliveryError("provider_invalid_response") from exc
        message_id = result.get("messageId") if isinstance(result, dict) else ""
        if not message_id:
            raise EmailDeliveryError("provider_invalid_response")
        return message_id

    def _send_smtp(self, api_key, sender, recipient, subject, text, html):
        import smtplib
        from email.message import EmailMessage

        login = getattr(settings, "BREVO_SMTP_LOGIN", "") or sender
        message = EmailMessage()
        message["From"] = f"{getattr(settings, 'BREVO_SENDER_NAME', '') or 'BoardingEdu'} <{sender}>"
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(text)
        message.add_alternative(html, subtype="html")
        try:
            with smtplib.SMTP("smtp-relay.brevo.com", 587, timeout=8) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                smtp.login(login, api_key)
                smtp.send_message(message)
        except smtplib.SMTPAuthenticationError as exc:
            raise EmailDeliveryError("provider_rejected") from exc
        except (TimeoutError, OSError, smtplib.SMTPException) as exc:
            raise EmailDeliveryError("provider_connection_error") from exc
        return "brevo-smtp"

def get_otp_email_provider():
    """Select the configured provider specifically for OTP emails."""

    provider = getattr(settings, "OTP_EMAIL_PROVIDER", "auto")

    if provider == "brevo":
        if not settings.BREVO_API_KEY or not settings.BREVO_SENDER_EMAIL:
            raise EmailDeliveryError("email_not_configured")
        return BrevoEmailProvider()

    if provider == "cloudflare":
        if not settings.CLOUDFLARE_EMAIL_API_TOKEN or not settings.CLOUDFLARE_EMAIL_ACCOUNT_ID:
            raise EmailDeliveryError("email_not_configured")
        return CloudflareEmailProvider()

    if provider == "resend":
        if not settings.RESEND_API_KEY:
            raise EmailDeliveryError("email_not_configured")
        return ResendEmailProvider()

    if provider == "auto":
        if settings.CLOUDFLARE_EMAIL_API_TOKEN and settings.CLOUDFLARE_EMAIL_ACCOUNT_ID:
            return CloudflareEmailProvider()

        if settings.BREVO_API_KEY and settings.BREVO_SENDER_EMAIL:
            return BrevoEmailProvider()

        if settings.RESEND_API_KEY:
            return ResendEmailProvider()

    raise EmailDeliveryError("email_not_configured")

def get_email_provider():
    if settings.EMAIL_PROVIDER == "cloudflare":
        return CloudflareEmailProvider()
    if settings.EMAIL_PROVIDER == "resend":
        return ResendEmailProvider()
    raise EmailDeliveryError("email_provider_not_supported")
