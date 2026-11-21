from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsPlatformAdmin
from apps.turnstile import verify_turnstile
from config.pagination import SchoolDirectoryPagination

from .models import BlogCategory, BlogPost, BlogSubscriber
from .serializers import (
    BlogCategorySerializer,
    BlogPostCardSerializer,
    BlogPostDetailSerializer,
    BlogSubscribeSerializer,
)
from .services import sync_blog_subscriber


class BlogPagination(SchoolDirectoryPagination):
    page_size = 9


class BlogCategoryPagination(BlogPagination):
    page_size = 50


def published_posts():
    return (
        BlogPost.objects.published()
        .select_related("category", "author")
        .order_by("-published_at", "-created_at")
    )


class BlogListView(generics.ListAPIView):
    serializer_class = BlogPostCardSerializer
    permission_classes = [AllowAny]
    pagination_class = BlogPagination

    def get_queryset(self):
        return published_posts()


class BlogLatestView(BlogListView):
    pass


class BlogFeaturedView(BlogListView):
    def get_queryset(self):
        return published_posts().filter(featured=True)


class BlogCategoryPostView(BlogListView):
    def get_queryset(self):
        category = get_object_or_404(BlogCategory, slug=self.kwargs["slug"], is_active=True)
        return published_posts().filter(category=category)


class BlogSearchView(BlogListView):
    def get_queryset(self):
        term = (self.request.query_params.get("q") or "").strip()
        if len(term) < 2:
            return BlogPost.objects.none()
        return published_posts().filter(
            Q(title__icontains=term)
            | Q(short_description__icontains=term)
            | Q(content__icontains=term)
            | Q(category__name__icontains=term)
            | Q(author_name__icontains=term)
        )

    def list(self, request, *args, **kwargs):
        term = (request.query_params.get("q") or "").strip()
        if len(term) < 2:
            return Response({"detail": "Enter at least 2 characters to search articles."}, status=400)
        return super().list(request, *args, **kwargs)


class BlogDetailView(generics.RetrieveAPIView):
    serializer_class = BlogPostDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return published_posts()


class BlogPreviewView(generics.RetrieveAPIView):
    serializer_class = BlogPostDetailSerializer
    permission_classes = [IsPlatformAdmin]
    lookup_field = "slug"
    queryset = BlogPost.objects.select_related("category", "author")


class BlogCategoryListView(generics.ListAPIView):
    serializer_class = BlogCategorySerializer
    permission_classes = [AllowAny]
    pagination_class = BlogCategoryPagination

    def get_queryset(self):
        return BlogCategory.objects.filter(is_active=True)


class BlogSubscribeView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "blog_subscribe"

    def post(self, request):
        verify_turnstile(request)
        serializer = BlogSubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        subscriber, created = BlogSubscriber.objects.get_or_create(
            email=email,
            defaults={
                "consent": True,
                "consented_at": timezone.now(),
                "source": "blog",
            },
        )
        if created:
            sync_blog_subscriber(email)
        return Response(
            {"subscribed": True, "already_subscribed": not created},
            status=201 if created else 200,
        )
