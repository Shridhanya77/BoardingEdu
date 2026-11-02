import ipaddress
import socket
from io import BytesIO
from urllib.parse import urlsplit
from uuid import uuid4

import requests
from PIL import Image, ImageOps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, transaction
from django.db.models import Max, Q

from apps.schools.models import School, SchoolPhoto
from config.school_media import is_logo_school_media, rewrite_school_media_url

MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_SIZE = 1600
WEBP_QUALITY = 80
WATERMARK_PATH = settings.BASE_DIR / "static" / "admin" / "img" / "boardingedu-watermark-transparent.png"


class Command(BaseCommand):
    help = "Add optimized school images to Cloudflare R2 or manage existing gallery photos."

    def add_arguments(self, parser):
        parser.add_argument(
            "--school",
            help="Search by school name, code, or slug. If omitted, you will be prompted.",
        )
        parser.add_argument("--cover-url", help="Download and set this school's cover image.")
        parser.add_argument("--logo-url", help="Download and set this school's logo.")
        parser.add_argument("--gallery-url", help="Download and add a gallery image.")
        parser.add_argument(
            "--category",
            choices=[choice[0] for choice in SchoolPhoto.CATEGORY_CHOICES],
            help="Gallery category (required with --gallery-url unless entered interactively).",
        )
        parser.add_argument("--caption", default="", help="Optional gallery caption.")
        parser.add_argument("--alt-text", default="", help="Optional gallery image alt text.")

    def handle(self, *args, **options):
        image_options = {
            "cover": options["cover_url"],
            "logo": options["logo_url"],
            "gallery": options["gallery_url"],
        }
        selected_images = [(role, url) for role, url in image_options.items() if url]
        if len(selected_images) > 1:
            raise CommandError("Add one image per run; provide only one image URL option.")
        if options["category"] and not options["gallery_url"]:
            raise CommandError("--category can only be used with --gallery-url.")

        term = options["school"] or input("Search school by name, code, or slug: ").strip()
        if not term:
            raise CommandError("A school search term is required.")

        schools = list(
            School.objects.filter(
                Q(school_name__icontains=term)
                | Q(school_code__iexact=term)
                | Q(slug__iexact=term)
            )
            .order_by("school_name")[:25]
        )
        if not schools:
            raise CommandError(f"No school matched {term!r}.")

        school = self._choose_school(schools)
        if school is None:
            self.stdout.write("No changes made.")
            return

        if selected_images:
            role, url = selected_images[0]
            self._add_image(
                school,
                role,
                url,
                category=options["category"],
                caption=options["caption"],
                alt_text=options["alt_text"],
            )
            return

        while True:
            photos = list(
                SchoolPhoto.objects.filter(school=school, status=True).order_by(
                    "sort_order", "created_at"
                )
            )
            self._show_photos(school, photos)
            action = input(
                "\nChoose [a]dd image, set [c]over from gallery, "
                "[r]emove from gallery, or [q]uit: "
            ).strip().lower()

            if action in {"q", "quit"}:
                self.stdout.write("Finished managing school photos.")
                return
            if action in {"a", "add"}:
                self._prompt_add_image(school)
            elif action in {"c", "cover"}:
                self._set_cover(school, photos)
            elif action in {"r", "remove"}:
                self._remove_from_gallery(photos)
            else:
                self.stderr.write("Enter a, c, r, or q.")

    def _choose_school(self, schools):
        for index, school in enumerate(schools, start=1):
            self.stdout.write(
                f"{index}. {school.school_name} ({school.school_code}) - {school.slug}"
            )
        while True:
            choice = input("Choose a school number, or q to cancel: ").strip().lower()
            if choice in {"q", "quit"}:
                return None
            if choice.isdigit() and 1 <= int(choice) <= len(schools):
                return schools[int(choice) - 1]
            self.stderr.write(f"Enter a number from 1 to {len(schools)}, or q.")

    def _show_photos(self, school, photos):
        self.stdout.write(f"\n{school.school_name} ({school.school_code})")
        self.stdout.write(f"Current cover URL: {school.school_image_url or '(not set)'}")
        self.stdout.write(f"Current logo URL: {school.school_logo_url or '(not set)'}")
        if not photos:
            self.stdout.write("No active gallery photos.")
            return

        self.stdout.write("Active gallery photos:")
        for index, photo in enumerate(photos, start=1):
            marker = " [current cover]" if photo.photo_url == school.school_image_url else ""
            caption = photo.caption or "(no caption)"
            self.stdout.write(
                f"{index}. {caption} | {photo.category} | {photo.photo_url}{marker}"
            )

    def _prompt_add_image(self, school):
        role = input("Image type: [c]over, [l]ogo, or [g]allery: ").strip().lower()
        roles = {
            "c": "cover",
            "cover": "cover",
            "l": "logo",
            "logo": "logo",
            "g": "gallery",
            "gallery": "gallery",
        }
        if role not in roles:
            self.stderr.write("Enter c, l, or g.")
            return

        role = roles[role]
        url = input("Public HTTPS image URL: ").strip()
        category = self._prompt_category() if role == "gallery" else None
        caption = input("Gallery caption (optional): ").strip() if role == "gallery" else ""
        alt_text = input("Gallery alt text (optional): ").strip() if role == "gallery" else ""
        self._add_image(school, role, url, category, caption, alt_text)

    def _prompt_category(self):
        self.stdout.write("Gallery categories:")
        for index, (value, label) in enumerate(SchoolPhoto.CATEGORY_CHOICES, start=1):
            self.stdout.write(f"{index}. {label} ({value})")
        while True:
            choice = input("Category number: ").strip()
            if choice.isdigit() and 1 <= int(choice) <= len(SchoolPhoto.CATEGORY_CHOICES):
                return SchoolPhoto.CATEGORY_CHOICES[int(choice) - 1][0]
            self.stderr.write(f"Enter a number from 1 to {len(SchoolPhoto.CATEGORY_CHOICES)}.")

    def _add_image(self, school, role, url, category=None, caption="", alt_text=""):
        if not url:
            raise CommandError("An image URL is required.")
        if role == "gallery" and category not in dict(SchoolPhoto.CATEGORY_CHOICES):
            category = self._prompt_category()

        image_bytes = self._download_image(url)
        optimized = self._optimize_image(image_bytes, add_watermark=role == "gallery")
        self.stdout.write(f"Source: {url}")
        self.stdout.write(
            f"Ready to upload {len(optimized) / 1024:.1f} KB optimized WebP for "
            f"{school.school_name} as {role}"
            + (f" ({category})" if role == "gallery" else "")
            + "."
        )
        if input("Upload to Cloudflare R2 and update the school? [y/N]: ").strip().lower() != "y":
            self.stdout.write("No changes made.")
            return

        filename = f"{school.slug}-{role}-{uuid4().hex}.webp"
        self._upload_to_r2(filename, optimized)
        stored_url = rewrite_school_media_url(f"/media/schools/{filename}")

        try:
            with transaction.atomic():
                if role == "cover":
                    school.school_image_url = stored_url
                    school.save(update_fields=["school_image_url", "updated_at"])
                elif role == "logo":
                    school.school_logo_url = stored_url
                    school.save(update_fields=["school_logo_url", "updated_at"])
                else:
                    next_order = (
                        SchoolPhoto.objects.filter(school=school).aggregate(
                            last_order=Max("sort_order")
                        )["last_order"]
                        or 0
                    ) + 1
                    if next_order > 65_535:
                        raise CommandError("This school's gallery has reached the photo order limit.")
                    SchoolPhoto.objects.create(
                        school=school,
                        photo_url=stored_url,
                        caption=caption,
                        alt_text=alt_text,
                        category=category,
                        sort_order=next_order,
                        status=True,
                    )
        except DatabaseError as exc:
            raise CommandError(
                f"The image was uploaded to R2 as {filename}, but its database record "
                "could not be saved. Check the database before retrying."
            ) from exc

        self.stdout.write(
            self.style.SUCCESS(f"{role.title()} image optimized and uploaded: {stored_url}")
        )
        if role == "gallery":
            self.stdout.write(f"Gallery category: {category}")

    def _download_image(self, url):
        try:
            parsed = urlsplit(url)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.port not in (None, 443)
            ):
                raise CommandError("Use a public HTTPS image URL without credentials or a custom port.")
            addresses = {
                ipaddress.ip_address(result[4][0])
                for result in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
            }
            if not addresses or any(not address.is_global for address in addresses):
                raise CommandError("The image URL must resolve only to public internet addresses.")
        except (ValueError, socket.gaierror) as exc:
            raise CommandError(f"Invalid or unreachable image URL: {exc}") from exc

        try:
            with requests.get(
                url,
                stream=True,
                timeout=(10, 30),
                allow_redirects=False,
                headers={"User-Agent": "BoardingEdu-school-image-manager/1.0"},
            ) as response:
                if response.is_redirect:
                    raise CommandError("Image URL redirects are not accepted; use its final HTTPS URL.")
                response.raise_for_status()
                content_length = response.headers.get("Content-Length")
                if content_length and content_length.isdigit() and int(content_length) > MAX_IMAGE_BYTES:
                    raise CommandError("The source image exceeds the 15 MB download limit.")
                body = bytearray()
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    body.extend(chunk)
                    if len(body) > MAX_IMAGE_BYTES:
                        raise CommandError("The source image exceeds the 15 MB download limit.")
                if not body:
                    raise CommandError("The image URL returned an empty response.")
                return bytes(body)
        except requests.RequestException as exc:
            raise CommandError(f"Could not download the image: {exc}") from exc

    def _optimize_image(self, image_bytes, add_watermark):
        try:
            with BytesIO(image_bytes) as source:
                with Image.open(source) as opened:
                    if opened.width * opened.height > MAX_IMAGE_PIXELS:
                        raise CommandError("The source image exceeds the 40-megapixel limit.")
                    image = ImageOps.exif_transpose(opened).copy()
                    if image.mode not in ("RGB", "RGBA"):
                        image = image.convert(
                            "RGBA" if "transparency" in image.info else "RGB"
                        )
                    image.thumbnail(
                        (MAX_IMAGE_SIZE, MAX_IMAGE_SIZE),
                        Image.Resampling.LANCZOS,
                    )

            if add_watermark:
                if not WATERMARK_PATH.is_file():
                    raise CommandError(f"Watermark asset is missing: {WATERMARK_PATH}")
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
        except (OSError, ValueError, Image.DecompressionBombError) as exc:
            raise CommandError(f"Could not process this image: {exc}") from exc

    def _upload_to_r2(self, filename, image_bytes):
        required = (
            settings.R2_ACCOUNT_ID,
            settings.R2_ACCESS_KEY_ID,
            settings.R2_SECRET_ACCESS_KEY,
            settings.R2_BUCKET_NAME,
        )
        if not all(required):
            raise CommandError(
                "Cloudflare R2 is not configured. Set the CLOUDFLARE_R2_* variables "
                "in backend/.env before adding images."
            )

        import boto3
        from botocore.exceptions import BotoCoreError, ClientError

        try:
            client = boto3.client(
                "s3",
                endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
            )
            client.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=f"schools/{filename}",
                Body=image_bytes,
                ContentType="image/webp",
                CacheControl="public, max-age=31536000, immutable",
            )
        except (BotoCoreError, ClientError, ValueError) as exc:
            raise CommandError(f"Could not upload the optimized image to Cloudflare R2: {exc}") from exc

    def _set_cover(self, school, photos):
        photo = self._selected_photo(photos, "Photo number to use as cover: ")
        if photo is None:
            return
        if is_logo_school_media(f"{photo.photo_url} {photo.caption} {photo.category}"):
            self.stderr.write("Logo and watermark photos cannot be used as covers.")
            return
        self.stdout.write(f"Selected cover: {photo.photo_url}")
        if input("Set this as the school's cover image? [y/N]: ").strip().lower() != "y":
            self.stdout.write("Cover unchanged.")
            return

        with transaction.atomic():
            school.school_image_url = photo.photo_url
            school.save(update_fields=["school_image_url", "updated_at"])
        self.stdout.write(self.style.SUCCESS("Cover image updated."))

    def _selected_photo(self, photos, prompt):
        if not photos:
            self.stdout.write("There are no active photos to choose.")
            return None
        while True:
            choice = input(prompt).strip()
            if choice.isdigit() and 1 <= int(choice) <= len(photos):
                return photos[int(choice) - 1]
            self.stderr.write(f"Enter a number from 1 to {len(photos)}.")

    def _remove_from_gallery(self, photos):
        if not photos:
            self.stdout.write("There are no active photos to remove.")
            return
        raw_choices = input(
            "Photo number(s) to hide from the gallery (comma-separated): "
        ).strip()
        try:
            indexes = {int(value.strip()) for value in raw_choices.split(",")}
        except ValueError:
            self.stderr.write("Enter photo numbers separated by commas.")
            return
        if not indexes or any(index < 1 or index > len(photos) for index in indexes):
            self.stderr.write(f"Choose number(s) from 1 to {len(photos)}.")
            return

        selected = [photos[index - 1] for index in sorted(indexes)]
        for photo in selected:
            self.stdout.write(f"- {photo.caption or '(no caption)'}: {photo.photo_url}")
        if input("Hide these photos from the public gallery? [y/N]: ").strip().lower() != "y":
            self.stdout.write("No photos changed.")
            return

        with transaction.atomic():
            SchoolPhoto.objects.filter(
                photo_id__in=[photo.photo_id for photo in selected],
                status=True,
            ).update(status=False)
        self.stdout.write(
            self.style.SUCCESS(f"Removed {len(selected)} photo(s) from the gallery.")
        )
