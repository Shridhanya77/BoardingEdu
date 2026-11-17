"""Allowlist sanitizer for blog article HTML.

Article content is stored only after it passes through this module, and the
public serializer sanitizes it again before it is returned to the website.
"""

from dataclasses import dataclass
from html import escape
from html.parser import HTMLParser
import re

from django.utils.text import slugify


ALLOWED_TAGS = {
    "p",
    "br",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "a",
    "strong",
    "em",
    "blockquote",
    "img",
    "figure",
    "figcaption",
    "hr",
}
VOID_TAGS = {"br", "img", "hr"}
DROP_WITH_CONTENT = {"script", "style", "iframe", "object", "embed", "form", "noscript", "template"}
HEADING_TAGS = {"h2", "h3"}
_UNSAFE_URL = re.compile(r"(?i)^(javascript|data|vbscript):")
_MAILTO = re.compile(r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")
_TAG_LIKE = re.compile(r"<\s*/?\s*[a-zA-Z]")


@dataclass
class SanitizedArticle:
    html: str
    headings: list


def _safe_url(value, *, allow_mailto):
    candidate = (value or "").replace("\x00", "").strip()
    if not candidate or candidate.startswith("//") or _UNSAFE_URL.match(candidate):
        return ""
    if candidate.startswith("/") and not candidate.startswith("//"):
        return candidate
    if allow_mailto and candidate.lower().startswith("mailto:"):
        address = candidate[7:]
        return candidate if _MAILTO.match(address) else ""
    lowered = candidate.lower()
    if lowered.startswith("https://") or lowered.startswith("http://"):
        return candidate
    return ""


class _ArticleSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.stack = []
        self.skip_depth = 0
        self.headings = []
        self._heading_chunks = None
        self._heading_level = None
        self._ids = set()

    def handle_starttag(self, tag, attrs):
        self._start(tag, attrs, void=False)

    def handle_startendtag(self, tag, attrs):
        self._start(tag, attrs, void=True)

    def _start(self, tag, attrs, *, void):
        tag = tag.lower()
        if self.skip_depth:
            if tag in DROP_WITH_CONTENT:
                self.skip_depth += 1
            return
        if tag in DROP_WITH_CONTENT:
            self.skip_depth = 1
            return
        if self._heading_chunks is not None:
            return
        if tag not in ALLOWED_TAGS:
            if not void:
                self.stack.append(None)
            return
        if tag in HEADING_TAGS and not void:
            self._heading_chunks = []
            self._heading_level = int(tag[1])
            self.stack.append("heading")
            return
        rendered = self._render_start(tag, attrs)
        if not rendered:
            if tag not in VOID_TAGS and not void:
                self.stack.append(None)
            return
        self.parts.append(rendered)
        if tag not in VOID_TAGS and not void:
            self.stack.append(tag)

    def _render_start(self, tag, attrs):
        attributes = {name.lower(): value for name, value in attrs if name}
        if tag == "a":
            href = _safe_url(attributes.get("href"), allow_mailto=True)
            if not href:
                return ""
            extra = ""
            if href.startswith(("http://", "https://")):
                extra = ' target="_blank" rel="noopener noreferrer"'
            return f'<a href="{escape(href, quote=True)}"{extra}>'
        if tag == "img":
            src = _safe_url(attributes.get("src"), allow_mailto=False)
            if not src:
                return ""
            alt = escape(attributes.get("alt") or "", quote=True)
            return f'<img src="{escape(src, quote=True)}" alt="{alt}" loading="lazy">'
        if tag in VOID_TAGS:
            return f"<{tag}>"
        return f"<{tag}>"

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.skip_depth:
            if tag in DROP_WITH_CONTENT:
                self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self._heading_chunks is not None and tag not in HEADING_TAGS:
            return
        if not self.stack:
            return
        opened = self.stack.pop()
        if opened == "heading":
            self._flush_heading()
            return
        if opened is None:
            return
        self.parts.append(f"</{opened}>")

    def handle_data(self, data):
        if self.skip_depth or not data:
            return
        if self._heading_chunks is not None:
            self._heading_chunks.append(data)
            return
        self.parts.append(escape(data))

    def _flush_heading(self):
        raw = " ".join("".join(self._heading_chunks or []).split())
        level = self._heading_level or 2
        self._heading_chunks = None
        self._heading_level = None
        if not raw:
            return
        base = (slugify(raw) or "section")[:80]
        identifier = base
        suffix = 2
        while identifier in self._ids:
            identifier = f"{base}-{suffix}"
            suffix += 1
        self._ids.add(identifier)
        self.headings.append({"id": identifier, "text": raw, "level": level})
        self.parts.append(f'<h{level} id="{identifier}">{escape(raw)}</h{level}>')

    def close_open_tags(self):
        while self.stack:
            opened = self.stack.pop()
            if opened == "heading":
                self._flush_heading()
            elif opened:
                self.parts.append(f"</{opened}>")


def sanitize_blog_html(raw):
    text = (raw or "").replace("\x00", "").strip()
    if not text:
        return SanitizedArticle(html="", headings=[])
    if not _TAG_LIKE.search(text):
        paragraphs = [
            escape(part.strip())
            for part in re.split(r"\n\s*\n", text)
            if part.strip()
        ]
        return SanitizedArticle(
            html="".join(f"<p>{paragraph}</p>" for paragraph in paragraphs),
            headings=[],
        )
    parser = _ArticleSanitizer()
    parser.feed(text)
    parser.close()
    parser.close_open_tags()
    return SanitizedArticle(html="".join(parser.parts), headings=parser.headings)


def visible_word_count(raw):
    sanitized = sanitize_blog_html(raw)
    plain = re.sub(r"<[^>]+>", " ", sanitized.html)
    return len(re.findall(r"[A-Za-z0-9']+", plain))
