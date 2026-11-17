# schools/utils.py
import re
import unicodedata


def slugify_url(text: str, max_length: int = 75) -> str:
    """
    Python equivalent of lib/pseo/slugify.ts.
    Must produce byte-identical output.
    """
    if not text:
        return ''

    # 1. Unicode NFD
    text = unicodedata.normalize('NFD', text)
    # 2. Strip diacritics
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    # 3. Lowercase
    text = text.lower()
    # 4. Strip apostrophes (straight + curly)
    text = text.replace("'", '').replace('\u2019', '')
    # 5. Non-alnum → hyphen
    text = re.sub(r'[^a-z0-9]+', '-', text)
    # 6. Collapse
    text = re.sub(r'-{2,}', '-', text)
    # 7. Trim
    text = text.strip('-')
    # 8. Cap
    return text[:max_length].rstrip('-')


def unique_school_slug(base: str, school_id: int | None = None,
                       max_attempts: int = 100) -> str:
    """
    Ensures the slug is unique across School records.
    If school_id is given, that record is excluded (for updates).
    """
    from .models import School
    base_slug = slugify_url(base)
    if not base_slug:
        raise ValueError('Slug is empty after normalization')

    qs = School.objects.all()
    if school_id:
        qs = qs.exclude(id=school_id)

    if not qs.filter(slug=base_slug).exists():
        return base_slug

    for i in range(2, max_attempts + 1):
        candidate = f'{base_slug}-{i}'
        if not qs.filter(slug=candidate).exists():
            return candidate

    raise RuntimeError(f'Could not generate unique slug for: {base}')