"""Slug rules aligned with the Next.js ``toSeoSlug`` helper."""

from __future__ import annotations

import re
import unicodedata


def seo_slug(value: str, *, max_len: int = 300) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().strip().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:max_len]
