from rest_framework import serializers

from .models import NotificationPreference


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = NotificationPreference
        fields = [
            "email",
            "saved_search_alerts",
            "admission_opening_alerts",
            "unsubscribed_at",
        ]
        read_only_fields = ["email", "unsubscribed_at"]

    def update(self, instance, validated_data):
        # Re-enabling any preference clears a previous full unsubscribe.
        if validated_data.get("saved_search_alerts") or validated_data.get(
            "admission_opening_alerts"
        ):
            instance.unsubscribed_at = None
        return super().update(instance, validated_data)

