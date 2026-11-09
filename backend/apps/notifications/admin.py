from django.contrib import admin

from .models import EmailDelivery


@admin.register(EmailDelivery)
class EmailDeliveryAdmin(admin.ModelAdmin):
    list_display = (
        "notification_type",
        "recipient",
        "status",
        "provider_message_id",
        "created_at",
    )
    list_filter = ("status", "notification_type", "created_at")
    search_fields = ("recipient", "provider_message_id")
    readonly_fields = (
        "delivery_id",
        "recipient",
        "subject",
        "notification_type",
        "status",
        "provider_message_id",
        "error_code",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
