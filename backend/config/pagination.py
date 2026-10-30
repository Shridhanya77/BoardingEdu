from urllib.parse import urlparse

from rest_framework.pagination import CursorPagination, PageNumberPagination


def api_relative_pagination_link(absolute_url: str | None) -> str | None:
    """Return a path+query relative to the API mount (no host).

    The Next.js frontend validates pagination URLs against ``NEXT_PUBLIC_API_BASE``.
    ``build_absolute_uri()`` often uses the browser/proxy host (e.g. localhost:3000),
    which does not match the configured API origin — relative links avoid that mismatch.
    """
    if not absolute_url:
        return None
    parsed = urlparse(absolute_url)
    path = parsed.path.rstrip("/") or "/"
    for prefix in ("/backend-api", "/api"):
        if path == prefix:
            path = "/"
            break
        if path.startswith(f"{prefix}/"):
            path = path[len(prefix) :] or "/"
            break
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{path}{query}"


class BoardingEduCursorPagination(CursorPagination):
    page_size = 20
    ordering = "-created_at"

    def get_next_link(self):
        return api_relative_pagination_link(super().get_next_link())

    def get_previous_link(self):
        return api_relative_pagination_link(super().get_previous_link())


class SchoolDirectoryPagination(PageNumberPagination):
    """Offset pagination for the public school directory.

    The directory listing needs a total ``count`` and addressable page
    numbers so the UI can show "N schools found" and numbered pages.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_next_link(self):
        return api_relative_pagination_link(super().get_next_link())

    def get_previous_link(self):
        return api_relative_pagination_link(super().get_previous_link())
