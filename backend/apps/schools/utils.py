
# backend/apps/schools/utils.py
import re
import unicodedata
from uuid import UUID

def slugify_url(text: str, max_length: int = 75) -> str:
    """
    Python version of frontend lib/pseo/slugify.ts — BYTE-IDENTICAL OUTPUT REQUIRED.
    Used for: School slugs, location slugs if Django slugify isn't enough.
    """
    if not text: return ''
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = text.lower()
    text = text.replace("'", '').replace('\u2019', '')  # straight + curly apostrophe
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = re.sub(r'-{2,}', '-', text)
    text = text.strip('-')
    return text[:max_length].rstrip('-')

def unique_school_slug(base: str, school_id: UUID | None = None, max_attempts: int = 100) -> str:
    """Auto-generates unique slug: 'st-marys', 'st-marys-2', 'st-marys-3', ..."""
    from .models import School
    from .slug_utils import seo_slug
    base_slug = seo_slug(base) or slugify_url(base)
    if not base_slug:
        raise ValueError(f"Cannot generate slug from empty name: {base}")
    qs = School.objects.all()
    if school_id:
        qs = qs.exclude(pk=school_id)
    if not qs.filter(slug=base_slug).exists():
        return base_slug
    for i in range(2, max_attempts + 1):
        candidate = f"{base_slug}-{i}"
        if not qs.filter(slug=candidate).exists():
            return candidate
    raise RuntimeError(f"Could not generate unique school slug for '{base}' after {max_attempts} attempts.")
