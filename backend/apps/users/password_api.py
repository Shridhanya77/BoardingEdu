from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.services import queue_email

from .models import User


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        if email:
            from apps.notifications.otp import OTP_ROLES, OtpError, issue_otp

            for user in User.objects.filter(email__iexact=email, is_active=True)[:1]:
                if user.role in OTP_ROLES:
                    try:
                        issue_otp(user, "password_reset", client_ip=request.META.get("REMOTE_ADDR", ""))
                    except OtpError:
                        return Response(
                            {"detail": "Verification email could not be sent. Try again shortly."},
                            status=503,
                        )
                    continue
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                link = f"{settings.FRONTEND_URL}/reset-password/?uid={uid}&token={token}"
                queue_email(
                    recipient=user.email,
                    subject="Reset your BoardingEdu password",
                    notification_type="password_reset",
                    heading="Reset your password",
                    body="Use the link below to choose a new password. If you did not ask for this, you can ignore the email.",
                    action_label="Choose a new password",
                    action_url=link,
                )
        return Response(
            {"detail": "If an account exists for that email, password reset instructions have been sent."}
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        uid = request.data.get("uid") or ""
        token = request.data.get("token") or ""
        password = request.data.get("password") or ""
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({"detail": "This reset link is invalid."}, status=400)
        if not default_token_generator.check_token(user, token):
            return Response({"detail": "This reset link is invalid or has expired."}, status=400)
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            return Response({"password": exc.messages}, status=400)
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Your password has been updated."})


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get("current_password") or ""
        password = request.data.get("password") or ""
        if not request.user.check_password(current):
            return Response({"detail": "The current password is incorrect."}, status=400)
        try:
            validate_password(password, request.user)
        except DjangoValidationError as exc:
            return Response({"password": exc.messages}, status=400)
        request.user.set_password(password)
        request.user.save(update_fields=["password"])
        return Response({"detail": "Your password has been updated."})
