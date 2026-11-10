import uuid

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User

from .access import subscription_summary
from .models import SubscriptionPayment, SubscriptionPlan
from .payments import (
    PaymentNotConfigured,
    PaymentVerificationFailed,
    activate_from_provider_payment,
    create_razorpay_order,
    provider_event_payment_id,
    signature_is_valid,
    webhook_is_valid,
)


def _school_for(user):
    if getattr(user, "role", None) != User.ROLE_SCHOOL_ADMIN:
        return None
    try:
        return user.school_admin_profile.school
    except Exception:
        return None


def _plan_row(plan):
    return {
        "plan_id": str(plan.plan_id),
        "name": plan.name,
        "description": plan.description,
        "price": str(plan.price),
        "currency": plan.currency,
        "duration_days": plan.duration_days,
        "lead_access": plan.lead_access,
        "lead_quota": plan.lead_quota,
    }


def _payment_row(payment):
    return {
        "payment_id": str(payment.payment_id),
        "plan_name": payment.plan.name,
        "amount": str(payment.amount),
        "currency": payment.currency,
        "status": payment.status,
        "created_at": payment.created_at,
        "verified_at": payment.verified_at,
    }


class PlanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _school_for(request.user) is None:
            return Response({"detail": "Subscription plans are for school administrators."}, status=403)
        plans = SubscriptionPlan.objects.filter(status=True)
        return Response([_plan_row(plan) for plan in plans])


class MySubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school_for(request.user)
        if school is None:
            return Response({"detail": "Subscriptions are for school administrators."}, status=403)
        payments = SubscriptionPayment.objects.filter(school=school).select_related("plan")[:20]
        return Response({
            "subscription": subscription_summary(school),
            "payments": [_payment_row(payment) for payment in payments],
        })


class CreateOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = _school_for(request.user)
        if school is None:
            return Response({"detail": "Only a school administrator can purchase a plan."}, status=403)
        plan = SubscriptionPlan.objects.filter(plan_id=request.data.get("plan_id"), status=True).first()
        if plan is None:
            return Response({"detail": "Choose an available plan."}, status=400)
        payment = SubscriptionPayment.objects.create(
            school=school,
            plan=plan,
            amount=plan.price,
            currency=plan.currency,
            provider_order_id=f"local-{uuid.uuid4()}",
        )
        try:
            key_id, amount_paise = create_razorpay_order(payment)
        except PaymentNotConfigured:
            return Response({"detail": "Online payment is not configured yet."}, status=503)
        except Exception:
            return Response({"detail": "The payment provider did not create an order."}, status=502)
        return Response({
            "payment_id": str(payment.payment_id),
            "key_id": key_id,
            "provider_order_id": payment.provider_order_id,
            "amount_paise": amount_paise,
            "currency": payment.currency,
            "plan": _plan_row(plan),
        })


class VerifyPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = _school_for(request.user)
        if school is None:
            return Response({"detail": "Only a school administrator can confirm a payment."}, status=403)
        order_id = request.data.get("razorpay_order_id") or ""
        provider_payment_id = request.data.get("razorpay_payment_id") or ""
        signature = request.data.get("razorpay_signature") or ""
        payment = SubscriptionPayment.objects.select_related("plan", "school").filter(
            provider_order_id=order_id,
            school=school,
        ).first()
        if payment is None:
            return Response({"detail": "That payment order was not found for this school."}, status=404)
        try:
            valid = signature_is_valid(order_id, provider_payment_id, signature)
        except PaymentNotConfigured:
            return Response({"detail": "Online payment is not configured yet."}, status=503)
        if not valid or not provider_payment_id:
            payment.status = SubscriptionPayment.STATUS_FAILED
            payment.save(update_fields=["status"])
            return Response({"detail": "The payment could not be verified."}, status=400)
        try:
            subscription = activate_from_provider_payment(payment, provider_payment_id)
        except PaymentVerificationFailed as error:
            return Response({"detail": str(error)}, status=400)
        return Response({
            "subscription": subscription_summary(school),
            "subscription_id": str(subscription.subscription_id),
        })


@method_decorator(csrf_exempt, name="dispatch")
class RazorpayWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        body = request.body
        if not webhook_is_valid(body, request.headers.get("X-Razorpay-Signature", "")):
            return Response({"detail": "Invalid webhook signature."}, status=400)
        order_id, provider_payment_id = provider_event_payment_id(body)
        if not order_id or not provider_payment_id:
            return Response({"received": True})
        payment = SubscriptionPayment.objects.select_related("plan", "school").filter(
            provider_order_id=order_id
        ).first()
        if payment is None:
            return Response({"received": True})
        try:
            activate_from_provider_payment(payment, provider_payment_id)
        except PaymentVerificationFailed:
            return Response({"received": True})
        return Response({"received": True})
