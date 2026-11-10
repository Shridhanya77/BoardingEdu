import uuid

from django.conf import settings
from django.db import models


class EmailDelivery(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted by provider"
        DELIVERED = "DELIVERED", "Delivered"
        FAILED = "FAILED", "Failed"
        BOUNCED = "BOUNCED", "Bounced"

    delivery_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    recipient = models.EmailField()
    subject = models.CharField(max_length=200)
    notification_type = models.CharField(max_length=50)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    provider_message_id = models.CharField(max_length=200, blank=True)
    error_code = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.notification_type}: {self.status}"
