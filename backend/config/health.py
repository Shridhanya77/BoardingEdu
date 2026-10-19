"""Liveness and readiness probes for container/orchestrator health checks."""
import os

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET

APP_VERSION = os.getenv("APP_VERSION", "1.0.0")


def _check_database():
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True, "ok"
    except Exception as exc:  # pragma: no cover - depends on infra state
        return False, str(exc)


def _check_cache():
    try:
        key = "healthz:probe"
        cache.set(key, "ok", 5)
        if cache.get(key) == "ok":
            return True, "ok"
        return False, "cache round-trip failed"
    except Exception as exc:  # pragma: no cover - depends on infra state
        return False, str(exc)


def _check_search():
    """Search is optional; returns None when not configured."""
    url = os.getenv("MEILISEARCH_URL", "").strip()
    if not url:
        return None, "not configured"
    try:
        import requests

        response = requests.get(f"{url.rstrip('/')}/health", timeout=2)
        return response.ok, "ok" if response.ok else f"status {response.status_code}"
    except Exception as exc:  # pragma: no cover - depends on infra state
        return False, str(exc)


@require_GET
def healthz(request):
    """Liveness: the process is up and serving requests."""
    return JsonResponse({"status": "ok", "version": APP_VERSION})


@require_GET
def readyz(request):
    """Readiness: critical dependencies (database) are reachable."""
    database_ok, database_detail = _check_database()
    cache_ok, cache_detail = _check_cache()
    search_ok, search_detail = _check_search()

    checks = {
        "database": {"ok": database_ok, "detail": database_detail, "critical": True},
        "cache": {"ok": cache_ok, "detail": cache_detail, "critical": False},
        "search": {"ok": search_ok, "detail": search_detail, "critical": False},
    }
    ready = database_ok
    return JsonResponse(
        {"status": "ok" if ready else "unavailable", "version": APP_VERSION, "checks": checks},
        status=200 if ready else 503,
    )
