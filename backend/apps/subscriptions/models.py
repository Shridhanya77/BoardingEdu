import uuid
from decimal import Decimal

from django.db import models


class SubscriptionPlan(models.Model):
    """A priced lead-access plan. Prices live here so staff can change them."""

    plan_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=3, default="INR")
    duration_days = models.PositiveIntegerField(default=365)
    lead_access = models.BooleanField(
        default=True,
        help_text="When enabled, an active subscription reveals parent and student contact details.",
    )
    lead_quota = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Newest leads whose contacts are included. Leave empty for every lead during the term.",
    )
    status = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscription_plans"
        ordering = ["sort_order", "price"]

    def __str__(self):
        return self.name


class SchoolSubscription(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_ACTIVE = "ACTIVE"
    STATUS_EXPIRED = "EXPIRED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    subscription_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="lead_subscriptions",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="subscriptions",
    )
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "school_subscriptions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.school_id} {self.plan_id} {self.status}"


class SubscriptionPayment(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_PAID = "PAID"
    STATUS_FAILED = "FAILED"
    STATUS_REFUNDED = "REFUNDED"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PAID, "Paid"),
        (STATUS_FAILED, "Failed"),
        (STATUS_REFUNDED, "Refunded"),
    ]

    payment_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="subscription_payments",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    subscription = models.ForeignKey(
        SchoolSubscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    provider = models.CharField(max_length=30, default="razorpay")
    provider_order_id = models.CharField(max_length=80, unique=True)
    provider_payment_id = models.CharField(max_length=80, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "subscription_payments"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.provider_order_id} {self.status}"
