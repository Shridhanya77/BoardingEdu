from rest_framework.pagination import CursorPagination, PageNumberPagination


class BoardingEduCursorPagination(CursorPagination):
    page_size = 20
    ordering = "-created_at"


class SchoolDirectoryPagination(PageNumberPagination):
    """Offset pagination for the public school directory.

    The directory listing needs a total ``count`` and addressable page
    numbers so the UI can show "N schools found" and numbered pages.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100