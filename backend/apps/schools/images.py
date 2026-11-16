"""Optimize school images the same way the photo manager does."""

from io import BytesIO

from PIL import Image, ImageOps
from django.conf import settings
from django.core.exceptions import ValidationError

MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_SIZE = 1600
WEBP_QUALITY = 80
WATERMARK_PATH = settings.BASE_DIR / "static" / "admin" / "img" / "boardingedu-watermark-transparent.png"


def optimize_school_image(image_bytes, *, add_watermark):
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValidationError("The image exceeds the 15 MB limit.")
    try:
        with BytesIO(image_bytes) as source:
            with Image.open(source) as opened:
                if opened.width * opened.height > MAX_IMAGE_PIXELS:
                    raise ValidationError("The image exceeds the 40-megapixel limit.")
                image = ImageOps.exif_transpose(opened).copy()
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGBA" if "transparency" in image.info else "RGB")
                image.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.Resampling.LANCZOS)

        if add_watermark:
            if not WATERMARK_PATH.is_file():
                raise ValidationError(f"Watermark asset is missing: {WATERMARK_PATH}")
            with Image.open(WATERMARK_PATH) as opened_watermark:
                watermark = opened_watermark.convert("RGBA")
            scale = min(
                image.width * 0.20 / watermark.width,
                image.height * 0.20 / watermark.height,
            )
            watermark_size = (
                max(1, round(watermark.width * scale)),
                max(1, round(watermark.height * scale)),
            )
            watermark = watermark.resize(watermark_size, Image.Resampling.LANCZOS)
            alpha = watermark.getchannel("A")
            watermark.putalpha(alpha.point(lambda value: round(value * 0.55)))
            margin = min(12, round(min(image.size) * 0.02))
            position = (
                image.width - watermark.width - margin,
                image.height - watermark.height - margin,
            )
            base = image.convert("RGBA")
            base.alpha_composite(watermark, position)
            image = base

        output = BytesIO()
        image.save(output, format="WEBP", quality=WEBP_QUALITY, method=6)
        return output.getvalue()
    except ValidationError:
        raise
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ValidationError(f"Could not process this image: {exc}") from exc
