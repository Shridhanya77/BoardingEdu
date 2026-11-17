"""Optimize blog uploads with the same WebP pipeline used for school media."""

import logging
from uuid import uuid4

from botocore.exceptions import BotoCoreError, ClientError
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from apps.schools.images import optimize_school_image

logger = logging.getLogger(__name__)

CLOUDFLARE_STORAGE_ERROR = (
    "The image was optimized but could not be stored in Cloudflare. "
    "Check the R2 configuration and try again."
)


def optimize_blog_image(uploaded):
    if uploaded is None or getattr(uploaded, "_blog_optimized", False):
        return uploaded
    uploaded.seek(0)
    optimized = optimize_school_image(uploaded.read(), add_watermark=True)
    content = ContentFile(optimized, name=f"{uuid4().hex}.webp")
    content._blog_optimized = True
    return content


def persist_optimized_upload(uploaded, folder):
    """Optimize a new upload and store it before the admin view calls model.save().

    Django admin does not catch ValidationError raised from model.save(), so a
    storage failure there becomes a generic HTTP 500. Returning the stored name
    makes the model field committed and lets the form show the real error.
    """
    if not uploaded or getattr(uploaded, "_committed", False):
        return uploaded
    if not hasattr(uploaded, "read") or getattr(uploaded, "_blog_optimized", False):
        return uploaded
    try:
        optimized = optimize_blog_image(uploaded)
        return default_storage.save(f"{folder}/{optimized.name}", optimized)
    except ValidationError:
        raise
    except (BotoCoreError, ClientError, OSError, ValueError) as exc:
        logger.exception("Cloudflare image upload failed")
        raise ValidationError(CLOUDFLARE_STORAGE_ERROR) from exc


def store_optimized_image(instance, field_name):
    field = getattr(instance, field_name)
    if not field or getattr(field, "_committed", True):
        return
    source = getattr(field, "file", None)
    if source is None or getattr(source, "_blog_optimized", False):
        return
    try:
        optimized = optimize_blog_image(source)
        field.save(optimized.name, optimized, save=False)
    except ValidationError:
        raise
    except (BotoCoreError, ClientError, OSError, ValueError) as exc:
        logger.exception("Cloudflare image upload failed")
        raise ValidationError(CLOUDFLARE_STORAGE_ERROR) from exc
