"""Stream optimized school files from Cloudflare R2."""

from __future__ import annotations

import os
import re
from functools import lru_cache
from urllib.parse import urlparse

from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.views.decorators.http import require_http_methods

SAFE_FILENAME = re.compile(
    r"^[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png|gif|avif)$",
    re.IGNORECASE,
)

# These hostnames do not currently serve R2 objects. Redirecting to them
# produces a 404 loop (Apache PHP on www, missing media DNS).
_UNUSABLE_PUBLIC_HOSTS = {
    "boardingedu.com",
    "www.boardingedu.com",
    "media.boardingedu.com",
    "media.boardingeu.com",
}


def school_media_filename(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    path = urlparse(raw, scheme="http").path if "://" in raw or raw.startswith("/") else raw
    filename = path.rstrip("/").split("/")[-1]
    return filename if SAFE_FILENAME.match(filename) else ""


def rewrite_school_media_url(value: str | None, request=None) -> str:
    """Point stored proxy URLs at this API so the browser never hits Apache."""
    raw = (value or "").strip()
    if not raw:
        return ""
    filename = school_media_filename(raw)
    if not filename:
        return raw
    parsed = urlparse(raw, scheme="http")
    host = (parsed.hostname or "").lower()
    path = parsed.path or raw
    is_proxy = (
        "/media/schools/" in f"{path}/"
        or host.endswith(".r2.cloudflarestorage.com")
        or host.endswith(".r2.dev")
        or host in _UNUSABLE_PUBLIC_HOSTS
    )
    if not is_proxy:
        return raw
    relative = f"/media/schools/{filename}"
    if request is not None:
        return request.build_absolute_uri(relative)
    return relative


def _public_media_url(filename: str) -> str:
    base = (os.getenv("CLOUDFLARE_R2_PUBLIC_BASE") or "").strip().rstrip("/")
    if not base:
        return ""
    host = (urlparse(base).hostname or "").lower()
    if host in _UNUSABLE_PUBLIC_HOSTS:
        return ""
    return f"{base}/{filename}"


MEDIA_URL_KEYS = (
    "school_logo_url",
    "school_image_url",
    "photo_url",
    "thumbnail_url",
    "icon_url",
)


class SchoolMediaUrlMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        for key in MEDIA_URL_KEYS:
            if key in data and data[key]:
                data[key] = rewrite_school_media_url(data[key], request)
        return data


@lru_cache(maxsize=1)
def _r2_client():
    try:
        import boto3
    except ImportError:
        return None

    account_id = (os.getenv("CLOUDFLARE_R2_ACCOUNT_ID") or "").strip()
    access_key = (os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID") or "").strip()
    secret_key = (os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY") or "").strip()
    if not (account_id and access_key and secret_key):
        return None

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def _r2_bucket() -> str:
    return (os.getenv("CLOUDFLARE_R2_BUCKET") or "boardingedu-media").strip()


@require_http_methods(["GET", "HEAD"])
def serve_school_media(request, filename: str):
    filename = filename.strip().rstrip("/")
    if not SAFE_FILENAME.match(filename):
        raise Http404("Invalid media name")

    public_url = _public_media_url(filename)
    client = _r2_client()
    if client is None:
        if public_url:
            return HttpResponseRedirect(public_url)
        raise Http404("R2 is not configured")

    from botocore.exceptions import ClientError

    bucket = _r2_bucket()
    last_error: Exception | None = None
    for key in (f"schools/{filename}", filename):
        try:
            if request.method == "HEAD":
                obj = client.head_object(Bucket=bucket, Key=key)
                response = HttpResponse(status=200, content_type=obj.get("ContentType") or "image/webp")
            else:
                obj = client.get_object(Bucket=bucket, Key=key)
                response = HttpResponse(
                    obj["Body"].read(),
                    content_type=obj.get("ContentType") or "image/webp",
                )
            response["Cache-Control"] = "public, max-age=31536000, immutable"
            response["Access-Control-Allow-Origin"] = "*"
            return response
        except Exception as exc:
            last_error = exc
            if isinstance(exc, ClientError) and exc.response.get("Error", {}).get("Code") in {
                "NoSuchKey",
                "404",
                "NotFound",
            }:
                continue
            if public_url:
                return HttpResponseRedirect(public_url)
            raise Http404("Media unavailable") from exc

    if public_url:
        return HttpResponseRedirect(public_url)
    raise Http404("Not found") from last_error
