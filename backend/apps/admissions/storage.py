"""Private storage for admission documents and parent photos.

The public school-media bucket must not be the URL parents receive. Files are
read back through authenticated views. In local debug they stay on disk.
"""
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage


def private_application_storage():
    backend = settings.STORAGES["default"]["BACKEND"]
    if backend.endswith("S3Storage") and not settings.DEBUG:
        from storages.backends.s3 import S3Storage

        options = dict(settings.STORAGES["default"]["OPTIONS"])
        options.update(
            {
                "querystring_auth": True,
                "querystring_expire": 60,
                "custom_domain": None,
                "location": "private/applications",
                "file_overwrite": False,
                "default_acl": None,
            }
        )
        options.pop("object_parameters", None)
        return S3Storage(**options)
    root = Path(settings.BASE_DIR) / "private_uploads" / "applications"
    root.mkdir(parents=True, exist_ok=True)
    return FileSystemStorage(location=str(root), base_url=None)
