from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import User


class EmailVerificationJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if (
            user.role in {User.ROLE_PARENT, User.ROLE_SCHOOL_ADMIN}
            and not user.is_superuser
            and not user.is_email_verified
        ):
            raise AuthenticationFailed(
                "Email verification is required before accessing this account.",
                code="email_not_verified",
            )
        return user
