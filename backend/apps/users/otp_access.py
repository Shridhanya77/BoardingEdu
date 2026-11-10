from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.notifications.otp import OTP_ROLES


class VerifiedEmailJWTAuthentication(JWTAuthentication):
    """Parent and school-admin tokens work only after the email is verified."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        if user.role in OTP_ROLES and not user.is_email_verified:
            raise AuthenticationFailed("Verify your email before continuing.")
        return user, token
