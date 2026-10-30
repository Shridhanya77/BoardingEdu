"""Stream optimized school WebP files from Cloudflare R2."""

from __future__ import annotations

import os
import re
from functools import lru_cache

from django.http import Http404, HttpResponse
from django.views.decorators.http import require_GET

SAFE_FILENAME = re.compile(r"^boardingedu-[a-z0-9.-]+\.webp$", re.IGNORECASE)


@lru_cache(maxsize=1)
def _r2_client():
    try:
        import boto3
    except ImportError as exc:
        raise Http404("R2 client unavailable") from exc

    account_id = (os.getenv("CLOUDFLARE_R2_ACCOUNT_ID") or "").strip()
    access_key = (os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID") or "").strip()
    secret_key = (os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY") or "").strip()
    if not (account_id and access_key and secret_key):
        raise Http404("R2 is not configured")

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def _r2_bucket() -> str:
    return (os.getenv("CLOUDFLARE_R2_BUCKET") or "school-images").strip()


@require_GET
def serve_school_media(request, filename: str):
    if not SAFE_FILENAME.match(filename):
        raise Http404("Invalid media name")

    key = f"schools/{filename}"
    client = _r2_client()
    bucket = _r2_bucket()
    try:
        obj = client.get_object(Bucket=bucket, Key=key)
    except Exception as exc:
        from botocore.exceptions import ClientError

        if isinstance(exc, ClientError) and exc.response.get("Error", {}).get("Code") in {
            "NoSuchKey",
            "404",
            "NotFound",
        }:
            raise Http404("Not found") from exc
        raise Http404("Media unavailable") from exc

    body = obj["Body"].read()
    response = HttpResponse(body, content_type=obj.get("ContentType") or "image/webp")
    response["Cache-Control"] = "public, max-age=31536000, immutable"
    return response
