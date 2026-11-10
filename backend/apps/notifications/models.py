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


class ParentNotification(models.Model):
    """In-dashboard notice for a parent. Email delivery stays on EmailDelivery."""

    notification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="parent_notifications",
    )
    enquiry = models.ForeignKey(
        "admissions.AdmissionEnquiry",
        on_delete=models.CASCADE,
        related_name="parent_notifications",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=160)
    body = models.TextField(blank=True)
    kind = models.CharField(max_length=40, default="application")
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "parent_notifications"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "read_at", "created_at"])]

    def __str__(self):
        return self.title


class OtpRecord(models.Model):
    """Fallback OTP storage used when Redis cannot be reached."""

    key = models.CharField(max_length=160, unique=True)
    value = models.TextField()
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "otp_records"
