from django.urls import path

from .views import SuggestionView

app_name = "search"

urlpatterns = [
    path("suggestions/", SuggestionView.as_view(), name="suggestions"),
]
