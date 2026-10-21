import hashlib
import os
import re
import time
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import requests


MAX_IMAGE_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class CloudinaryUploadError(Exception):
    pass


def _cloudinary_config():
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    delivery_host = os.getenv("SCHOOL_IMAGE_HOST", "images.boardingedu.com").strip().lower()
    if not cloud_name or not api_key or not api_secret:
        raise CloudinaryUploadError(
            "Cloudinary uploads are not configured. Set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
        )
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", cloud_name):
        raise CloudinaryUploadError("CLOUDINARY_CLOUD_NAME has an invalid format.")
    host_labels = delivery_host.split(".")
    if not all(
        re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
        for label in host_labels
    ):
        raise CloudinaryUploadError("SCHOOL_IMAGE_HOST has an invalid format.")
    return cloud_name, api_key, api_secret, delivery_host


def _validate_image(uploaded_file):
    extension = os.path.splitext(uploaded_file.name)[1].lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise CloudinaryUploadError("Use a JPG, PNG, or WebP image.")
    if uploaded_file.size > MAX_IMAGE_SIZE:
        raise CloudinaryUploadError("Image files must be 10 MB or smaller.")

    header = uploaded_file.read(12)
    uploaded_file.seek(0)
    valid = (
        header.startswith(b"\xff\xd8\xff")
        or header.startswith(b"\x89PNG\r\n\x1a\n")
        or (header.startswith(b"RIFF") and header[8:12] == b"WEBP")
    )
    if not valid:
        raise CloudinaryUploadError("The selected file is not a valid JPG, PNG, or WebP image.")


def upload_school_image(uploaded_file, *, school_id, image_kind):
    _validate_image(uploaded_file)
    cloud_name, api_key, api_secret, delivery_host = _cloudinary_config()
    timestamp = str(int(time.time()))
    folder = f"boardingedu/schools/{school_id}"
    public_id = f"{image_kind}-{uuid4().hex}"
    signed_params = {
        "folder": folder,
        "public_id": public_id,
        "timestamp": timestamp,
    }
    signature_payload = "&".join(
        f"{key}={value}" for key, value in sorted(signed_params.items())
    )
    signature = hashlib.sha1(
        f"{signature_payload}{api_secret}".encode("utf-8")
    ).hexdigest()
    endpoint = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
    try:
        response = requests.post(
            endpoint,
            data={
                **signed_params,
                "api_key": api_key,
                "signature": signature,
            },
            files={
                "file": (
                    os.path.basename(uploaded_file.name),
                    uploaded_file,
                    getattr(uploaded_file, "content_type", None) or "application/octet-stream",
                )
            },
            timeout=(5, 30),
        )
    except requests.RequestException as error:
        raise CloudinaryUploadError(
            "Cloudinary could not be reached. Check the server network and try again."
        ) from error

    if not response.ok:
        raise CloudinaryUploadError(
            f"Cloudinary rejected the image upload (HTTP {response.status_code})."
        )

    try:
        result = response.json()
    except ValueError as error:
        raise CloudinaryUploadError("Cloudinary returned an invalid upload response.") from error

    secure_url = result.get("secure_url") if isinstance(result, dict) else None
    if not isinstance(secure_url, str):
        raise CloudinaryUploadError("Cloudinary did not return a secure image URL.")
    parsed_url = urlsplit(secure_url)
    provider_path_prefix = f"/{cloud_name}/image/upload/"
    if parsed_url.scheme != "https" or not parsed_url.path.startswith(provider_path_prefix):
        raise CloudinaryUploadError("Cloudinary returned an unsupported image URL.")

    custom_domain_path = parsed_url.path[len(f"/{cloud_name}"):]
    return urlunsplit(
        ("https", delivery_host, custom_domain_path, parsed_url.query, "")
    )
