from django.contrib import admin

from .models import SchoolSubscription, SubscriptionPayment, SubscriptionPlan


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "currency", "duration_days", "lead_access", "lead_quota", "status", "sort_order")
    list_filter = ("status", "lead_access")
    search_fields = ("name", "description")
    ordering = ("sort_order", "price")


@admin.register(SchoolSubscription)
class SchoolSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("school", "plan", "status", "starts_at", "expires_at")
    list_filter = ("status", "plan")
    search_fields = ("school__school_name", "school__school_code", "plan__name")
    autocomplete_fields = ("school", "plan")
    readonly_fields = ("subscription_id", "created_at", "updated_at")


@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(admin.ModelAdmin):
    list_display = ("provider_order_id", "school", "plan", "amount", "status", "created_at", "verified_at")
    list_filter = ("status", "provider")
    search_fields = ("provider_order_id", "provider_payment_id", "school__school_name")
    autocomplete_fields = ("school", "plan", "subscription")
    readonly_fields = ("payment_id", "created_at", "verified_at")
