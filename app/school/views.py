# schools/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import School, SchoolSlugHistory


class ResolveSlugView(APIView):
    """
    GET /api/v1/schools/resolve-slug/?slug=st-marys
    Returns the current canonical slug, or null if not found.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        slug = request.query_params.get('slug', '').strip()
        if not slug:
            return Response({'current_slug': None})

        # Fast path: slug is current
        current = School.objects.filter(slug=slug).values_list('slug', flat=True).first()
        if current:
            return Response({'current_slug': current})

        # Slow path: look up in history
        history = (
            SchoolSlugHistory.objects
            .select_related('school')
            .filter(old_slug=slug)
            .first()
        )
        if history:
            return Response({'current_slug': history.school.slug})

        return Response({'current_slug': None})