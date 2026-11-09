import logging

from celery import shared_task

from .email_provider import EmailDeliveryError
from .models import EmailDelivery
from .services import _render_and_send

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def deliver_email(self, delivery_id, heading, body, action_label="", action_url=""):
    try:
        delivery = EmailDelivery.objects.get(delivery_id=delivery_id)
        _render_and_send(
            delivery,
            heading=heading,
            body=body,
            action_label=action_label,
            action_url=action_url,
        )
    except EmailDeliveryError as exc:
        if self.request.retries >= self.max_retries:
            logger.error(
                "Email delivery retries exhausted",
                extra={"delivery_id": delivery_id, "error_code": exc.error_code},
            )
            raise
        raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1))
