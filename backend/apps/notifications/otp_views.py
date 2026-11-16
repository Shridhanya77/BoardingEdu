from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User

from .otp import OTP_ROLES, OtpError, issue_otp, verify_otp

PUBLIC_FAILURE = "That code is incorrect or has expired."


def _user_for_email(email):
    if not email:
        return None
    matches = list(User.objects.filter(email__iexact=email.strip(), is_active=True).order_by("pk")[:2])
    if len(matches) != 1:
        return None
    return matches[0]


def _tokens(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _error(exc):
    if exc.code in {"cooldown", "rate_limited"}:
        return Response({"detail": "Please wait before requesting another code."}, status=429)
    if exc.code in {"email_not_configured", "provider_rejected", "provider_timeout", "provider_connection_error", "otp_store_unavailable"}:
        return Response({"detail": "Verification email could not be sent. Try again shortly."}, status=503)
    if exc.code == "too_many_attempts":
        return Response({"detail": "Too many attempts. Request a new code."}, status=400)
    return Response({"detail": PUBLIC_FAILURE}, status=400)


class OtpVerifyView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        purpose = request.data.get("purpose") or ""
        code = str(request.data.get("otp") or "")
        user = _user_for_email(request.data.get("email") or "")
        if user is None or user.role not in OTP_ROLES or purpose not in {"register", "login", "password_reset"}:
            return Response({"detail": PUBLIC_FAILURE}, status=400)
        if purpose == "login" and not user.is_email_verified:
            return Response({"detail": "Verify your email before signing in."}, status=403)
        try:
            verify_otp(user, purpose, code)
        except OtpError as exc:
            return _error(exc)
        if purpose == "register":
            user.is_email_verified = True
            user.email_verified_at = timezone.now()
            user.save(update_fields=["is_email_verified", "email_verified_at"])
        if purpose == "password_reset":
            password = request.data.get("password") or ""
            try:
                validate_password(password, user)
            except DjangoValidationError as exc:
                return Response({"password": exc.messages}, status=400)
            user.set_password(password)
            user.save(update_fields=["password"])
            return Response({"detail": "Your password has been updated."})
        return Response(_tokens(user))


class OtpResendView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        purpose = request.data.get("purpose") or ""
        user = _user_for_email(request.data.get("email") or "")
        if user is None or user.role not in OTP_ROLES or purpose not in {"register", "login", "password_reset"}:
            return Response({"detail": "No parent or school admin account uses that email."}, status=400)
        if purpose == "login" and not user.is_email_verified:
            purpose = "register"
        if purpose == "register" and user.is_email_verified:
            purpose = "login"
        try:
            issue_otp(user, purpose, client_ip=request.META.get("REMOTE_ADDR", ""))
        except OtpError as exc:
            return _error(exc)
        return Response({"detail": "A verification code was sent to that email.", "purpose": purpose})


class EmailChangeOtpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in OTP_ROLES:
            return Response({"detail": "Email verification is not required for this account."}, status=400)
        email = (request.data.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return Response({"detail": "Enter a valid email address."}, status=400)
        if User.objects.filter(email__iexact=email).exclude(pk=request.user.pk).exists():
            return Response({"detail": "That email cannot be used."}, status=400)
        try:
            issue_otp(
                request.user,
                "email_change",
                recipient=email,
                pending_email=email,
                client_ip=request.META.get("REMOTE_ADDR", ""),
            )
        except OtpError as exc:
            return _error(exc)
        return Response({"detail": "A verification code was sent to the new email address."})


class EmailChangeVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in OTP_ROLES:
            return Response({"detail": "Email verification is not required for this account."}, status=400)
        try:
            record = verify_otp(request.user, "email_change", str(request.data.get("otp") or ""))
        except OtpError as exc:
            return _error(exc)
        email = record.get("pending_email") or ""
        if not email:
            return Response({"detail": PUBLIC_FAILURE}, status=400)
        request.user.email = email
        request.user.is_email_verified = True
        request.user.email_verified_at = timezone.now()
        request.user.save(update_fields=["email", "is_email_verified", "email_verified_at"])
        return Response({"detail": "Your email address has been updated.", "email": email})
