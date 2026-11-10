from django.urls import path

from .views import ResendWebhookView

app_name = "notifications"

urlpatterns = [
    path("resend-webhook/", ResendWebhookView.as_view(), name="resend-webhook"),
]
