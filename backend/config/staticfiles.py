"""Static-file helpers for Jazzmin under manifest storage.

django-jazzmin 3.0.5 renders this on every admin page, including login:

    data-theme-base="{% static 'vendor/bootswatch' %}"

``vendor/bootswatch`` is a directory of theme stylesheets, not a file, so
``CompressedManifestStaticFilesStorage`` has no manifest entry for it and
raises ``ValueError`` while rendering ``/admin/``. The Bootswatch CSS files
themselves are shipped in the package and are collected normally. The theme
switcher appends ``/<theme>/bootstrap.min.css`` to that prefix, so the prefix
must stay an unhashed static URL. ``{% get_static_prefix %}`` reads
``STATIC_URL`` and does not consult the manifest.

Jazzmin also ships ``admin/js/cancel.js`` and ``admin/js/popup_response.js``
so related-object modals can close. Django ships the same paths. Jazzmin is
installed before ``django.contrib.admin``, so its copies are the ones that
must be collected. Skipping Django's copies removes the duplicate-path
warning without changing which file is served.
"""

from django.contrib.staticfiles.finders import AppDirectoriesFinder
from django.template.loaders.app_directories import Loader as AppDirectoriesLoader

# Paths Jazzmin overrides. Collected from Jazzmin, not from Django admin.
JAZZMIN_ADMIN_JS_OVERRIDES = frozenset(
    {
        "admin/js/cancel.js",
        "admin/js/popup_response.js",
    }
)

# Directory lookup in jazzmin/templates/admin/base.html (single or double quotes).
_BOOTSWATCH_DIRECTORY_REFS = (
    "{% static 'vendor/bootswatch' %}",
    '{% static "vendor/bootswatch" %}',
)
_BOOTSWATCH_DIRECTORY_FIX = "{% get_static_prefix %}vendor/bootswatch"


class JazzminAppDirectoriesLoader(AppDirectoriesLoader):
    """Load app templates, rewriting Jazzmin's Bootswatch directory reference."""

    def get_contents(self, origin):
        contents = super().get_contents(origin)
        if origin.template_name != "admin/base.html":
            return contents
        for broken in _BOOTSWATCH_DIRECTORY_REFS:
            if broken in contents:
                return contents.replace(broken, _BOOTSWATCH_DIRECTORY_FIX, 1)
        return contents


class JazzminAwareAppDirectoriesFinder(AppDirectoriesFinder):
    """Skip Django admin JS that Jazzmin replaces with the same relative path."""

    def list(self, ignore_patterns):
        jazzmin_storage = self.storages.get("jazzmin")
        admin_storage = self.storages.get("django.contrib.admin")
        for path, storage in super().list(ignore_patterns):
            normalized = path.replace("\\", "/")
            if (
                storage is admin_storage
                and jazzmin_storage is not None
                and normalized in JAZZMIN_ADMIN_JS_OVERRIDES
                and jazzmin_storage.exists(normalized)
            ):
                continue
            yield path, storage
