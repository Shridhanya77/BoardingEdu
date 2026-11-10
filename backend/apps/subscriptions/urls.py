from django.urls import path

from .views import CreateOrderView, MySubscriptionView, PlanListView, RazorpayWebhookView, VerifyPaymentView

app_name = "subscriptions"

urlpatterns = [
    path("plans/", PlanListView.as_view(), name="plans"),
    path("mine/", MySubscriptionView.as_view(), name="mine"),
    path("orders/", CreateOrderView.as_view(), name="orders"),
    path("verify/", VerifyPaymentView.as_view(), name="verify"),
    path("webhook/", RazorpayWebhookView.as_view(), name="webhook"),
]
