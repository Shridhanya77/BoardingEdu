from django.urls import path

from .views import ResendOTPView, ResendWebhookView, SendOTPView, VerifyOTPView

app_name = "notifications"

urlpatterns = [
    path("send-otp/", SendOTPView.as_view(), name="send-otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("resend-otp/", ResendOTPView.as_view(), name="resend-otp"),
    path("resend-webhook/", ResendWebhookView.as_view(), name="resend-webhook"),
]
