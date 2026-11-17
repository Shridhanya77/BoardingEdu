"""Optimize blog uploads with the same WebP pipeline used for school media."""

from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

from apps.schools.images import optimize_school_image


def optimize_blog_image(uploaded):
    if uploaded is None or getattr(uploaded, "_blog_optimized", False):
        return uploaded
    uploaded.seek(0)
    optimized = optimize_school_image(uploaded.read(), add_watermark=False)
    content = ContentFile(optimized, name=f"{uuid4().hex}.webp")
    content._blog_optimized = True
    return content


def store_optimized_image(instance, field_name):
    field = getattr(instance, field_name)
    if not field or getattr(field, "_committed", True):
        return
    source = getattr(field, "file", None)
    if source is None or getattr(source, "_blog_optimized", False):
        return
    try:
        optimized = optimize_blog_image(source)
    except ValidationError:
        raise
    field.save(optimized.name, optimized, save=False)
