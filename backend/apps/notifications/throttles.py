import hashlib

from rest_framework.throttling import SimpleRateThrottle


class OTPEmailThrottle(SimpleRateThrottle):
    scope = "otp_email"

    def get_cache_key(self, request, view):
        email = request.data.get("email", "")
        if not isinstance(email, str) or not email.strip():
            return None

        email_hash = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        return self.cache_format % {
            "scope": self.scope,
            "ident": email_hash,
        }
