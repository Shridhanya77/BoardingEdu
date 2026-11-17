from django.urls import path

from .views import NotificationPreferenceView, ResendWebhookView, UnsubscribeView

app_name = "notifications"

urlpatterns = [
    path("resend-webhook/", ResendWebhookView.as_view(), name="resend-webhook"),
    path("preferences/", NotificationPreferenceView.as_view(), name="preferences"),
    path("unsubscribe/<uuid:token>/", UnsubscribeView.as_view(), name="unsubscribe"),
]
