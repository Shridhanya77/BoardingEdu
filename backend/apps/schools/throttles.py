from django.utils.crypto import salted_hmac
from rest_framework.throttling import SimpleRateThrottle

from .engagement import VISITOR_COOKIE_NAME


class SchoolEngagementThrottleBase(SimpleRateThrottle):
    def get_ident(self, request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return super().get_ident(request)


class SchoolEngagementVisitorThrottle(SchoolEngagementThrottleBase):
    scope = "school_engagement_visitor"

    def get_cache_key(self, request, view):
        if getattr(request.user, "is_authenticated", False):
            identity = f"user:{request.user.pk}"
        else:
            identity = request.COOKIES.get(VISITOR_COOKIE_NAME) or self.get_ident(request)
        ident = salted_hmac(
            "boardingedu.school-engagement.throttle.v1",
            identity,
            algorithm="sha256",
        ).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": ident}


class SchoolEngagementIPThrottle(SchoolEngagementThrottleBase):
    scope = "school_engagement_ip"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        if ident is None:
            return None
        return self.cache_format % {"scope": self.scope, "ident": ident}
