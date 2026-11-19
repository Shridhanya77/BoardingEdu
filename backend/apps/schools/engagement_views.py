from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .engagement import (
    PUBLIC_ENGAGEMENT_EVENTS,
    attach_visitor_cookie,
    record_school_engagement,
)
from .querysets import public_school_queryset
from .throttles import SchoolEngagementIPThrottle, SchoolEngagementVisitorThrottle


class SchoolEngagementInputSerializer(serializers.Serializer):
    school_id = serializers.UUIDField()
    event_type = serializers.ChoiceField(choices=PUBLIC_ENGAGEMENT_EVENTS)


class SchoolEngagementView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [SchoolEngagementVisitorThrottle, SchoolEngagementIPThrottle]

    def post(self, request):
        serializer = SchoolEngagementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        school = public_school_queryset().filter(
            pk=serializer.validated_data["school_id"],
        ).first()
        if school is None:
            return Response({"detail": "School not found."}, status=404)

        result = record_school_engagement(
            school,
            serializer.validated_data["event_type"],
            request,
        )
        response = Response({"recorded": result.created})
        return attach_visitor_cookie(response, result.visitor_cookie)
