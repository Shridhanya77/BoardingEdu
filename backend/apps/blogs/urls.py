from django.urls import path

from .views import (
    BlogCategoryListView,
    BlogCategoryPostView,
    BlogDetailView,
    BlogFeaturedView,
    BlogLatestView,
    BlogListView,
    BlogPreviewView,
    BlogSearchView,
    BlogSubscribeView,
)

app_name = "blogs"

urlpatterns = [
    path("blogs/", BlogListView.as_view(), name="blog-list"),
    path("blogs/featured/", BlogFeaturedView.as_view(), name="blog-featured"),
    path("blogs/latest/", BlogLatestView.as_view(), name="blog-latest"),
    path("blogs/search/", BlogSearchView.as_view(), name="blog-search"),
    path("blogs/subscribe/", BlogSubscribeView.as_view(), name="blog-subscribe"),
    path("blogs/preview/<slug:slug>/", BlogPreviewView.as_view(), name="blog-preview"),
    path("blogs/category/<slug:slug>/", BlogCategoryPostView.as_view(), name="blog-category"),
    path("blogs/<slug:slug>/", BlogDetailView.as_view(), name="blog-detail"),
    path("blog-categories/", BlogCategoryListView.as_view(), name="blog-category-list"),
]
