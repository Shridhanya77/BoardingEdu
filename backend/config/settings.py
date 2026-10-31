import os
import re
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing.")

DEBUG = os.getenv("DEBUG", "False").lower() == "true"


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _csv_env(name, default=""):
    return [
        value.strip().rstrip("/")
        for value in os.getenv(name, default).split(",")
        if value.strip()
    ]


def _first_env(*names, default=""):
    """Return the first non-empty environment variable among `names`."""
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return default


# ----------------------------------------------------------------------------
# Hosts
# ----------------------------------------------------------------------------
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv(
        "ALLOWED_HOSTS",
        "localhost,127.0.0.1,.up.railway.app,"
        "boardingedu-production-ac84.up.railway.app,"
        "boardingedu-production-4144.up.railway.app,"
        "boardingedu-6ng7.onrender.com",
    ).split(",")
    if host.strip()
]

for _extra in (
    os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip(),
    os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip(),
):
    if _extra and _extra not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_extra)

_railway_static = os.getenv("RAILWAY_STATIC_URL", "").strip()
if _railway_static:
    try:
        from urllib.parse import urlparse

        _railway_host = urlparse(_railway_static).hostname
        if _railway_host and _railway_host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_railway_host)
    except ValueError:
        pass


# ----------------------------------------------------------------------------
# Apps / middleware
# ----------------------------------------------------------------------------
INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # 3rd party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    # Local apps
    'apps.geography.apps.GeographyConfig',
    'apps.schools.apps.SchoolsConfig',
    'apps.fees.apps.FeesConfig',
    'apps.admissions.apps.AdmissionsConfig',
    'apps.users.apps.UsersConfig',
    'apps.search.apps.SearchConfig',
    'apps.reviews.apps.ReviewsConfig',
    'apps.dashboards.apps.DashboardsConfig',
]

JAZZMIN_SETTINGS = {
    "site_title": "BoardingEdu Admin",
    "site_header": "BoardingEdu Admin",
    "site_brand": "BoardingEdu",
    "site_logo": "admin/img/boardingedu-logo.jpeg",
    "login_logo": "admin/img/boardingedu-logo.jpeg",
    "welcome_sign": "Welcome to the BoardingEdu administration panel",
    "copyright": "BoardingEdu",
    "search_model": "schools.School",
    "topmenu_links": [
        {"name": "Dashboard", "url": "admin:index", "icon": "fas fa-chart-line"},
        {"model": "schools.School", "icon": "fas fa-school"},
        {"model": "admissions.AdmissionEnquiry", "icon": "fas fa-envelope"},
        {"model": "reviews.Review", "icon": "fas fa-star"},
    ],
    "show_sidebar": True,
    "navigation_expanded": True,
    "order_with_respect_to": [
        "schools", "admissions", "reviews", "users",
        "geography", "fees", "search", "dashboards",
    ],
    "icons": {
        "schools": "fas fa-school",
        "schools.school": "fas fa-school",
        "admissions": "fas fa-user-graduate",
        "admissions.admissionenquiry": "fas fa-envelope",
        "reviews": "fas fa-star",
        "reviews.review": "fas fa-comment-dots",
        "users": "fas fa-users",
        "users.user": "fas fa-user",
        "geography": "fas fa-globe-asia",
        "fees": "fas fa-money-bill-wave",
        "search": "fas fa-search",
        "dashboards": "fas fa-chart-pie",
    },
    "related_modal_active": True,
    "show_ui_builder": False,
    "show_theme_chooser": True,
    "changeform_format": "horizontal_tabs",
}

JAZZMIN_UI_TWEAKS = {
    "navbar": "navbar-white navbar-light",
    "navbar_fixed": True,
    "sidebar": "sidebar-dark-navy",
    "sidebar_fixed": True,
    "sidebar_nav_compact_style": True,
    "sidebar_nav_child_indent": True,
    "accent": "accent-orange",
    "theme": "default",
    "default_theme_mode": "light",
}

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # MUST BE FIRST
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.gzip.GZipMiddleware',  # compresses large JSON responses
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'


# ----------------------------------------------------------------------------
# Database (PostgreSQL)
# ----------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing. Configure it in your environment.")

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=os.getenv("DATABASE_SSL_REQUIRE", str(not DEBUG)).lower() == "true",
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# ----------------------------------------------------------------------------
# Static files + Cloudflare R2 media storage
# ----------------------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_ROOT.mkdir(parents=True, exist_ok=True)
_static_dir = BASE_DIR / 'static'
STATICFILES_DIRS = [_static_dir] if _static_dir.is_dir() else []

# Accepts either R2_* or the CLOUDFLARE_R2_* names used by upload_cloudflare_r2.py
R2_BUCKET_NAME = _first_env("R2_BUCKET_NAME", "CLOUDFLARE_R2_BUCKET")
R2_ACCESS_KEY_ID = _first_env("R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = _first_env("R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY")

# Account ID must be ONLY the 32-character id. Strip a pasted URL if present.
R2_ACCOUNT_ID = re.sub(
    r"^https?:/*|\.r2\.cloudflarestorage\.com.*$",
    "",
    _first_env("R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCOUNT_ID"),
)

# Public domain only, e.g. pub-xxxx.r2.dev or media.yourdomain.com (no https://, no path)
R2_PUBLIC_DOMAIN = re.sub(
    r"^https?://", "", _first_env("R2_PUBLIC_DOMAIN")
).split("/")[0]

_r2_values = {
    "R2_BUCKET_NAME": R2_BUCKET_NAME,
    "R2_ACCOUNT_ID": R2_ACCOUNT_ID,
    "R2_ACCESS_KEY_ID": R2_ACCESS_KEY_ID,
    "R2_SECRET_ACCESS_KEY": R2_SECRET_ACCESS_KEY,
    "R2_PUBLIC_DOMAIN": R2_PUBLIC_DOMAIN,
}
_r2_missing = [name for name, value in _r2_values.items() if not value]

if not _r2_missing:
    _default_storage = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": R2_BUCKET_NAME,
            "endpoint_url": f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            "access_key": R2_ACCESS_KEY_ID,
            "secret_key": R2_SECRET_ACCESS_KEY,
            "region_name": "auto",
            "signature_version": "s3v4",
            "default_acl": None,        # R2 does not support ACLs
            "querystring_auth": False,  # plain public URLs, no signing
            "custom_domain": R2_PUBLIC_DOMAIN,
            "object_parameters": {
                "CacheControl": "public, max-age=31536000, immutable",
            },
        },
    }
elif DEBUG:
    # Local development without R2: store uploads on disk
    _default_storage = {"BACKEND": "django.core.files.storage.FileSystemStorage"}
    MEDIA_URL = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"
else:
    raise RuntimeError(
        "Cloudflare R2 is not configured. Missing: " + ", ".join(_r2_missing)
    )

STORAGES = {
    "default": _default_storage,
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'users.User'


# ----------------------------------------------------------------------------
# CORS / CSRF
# ----------------------------------------------------------------------------
# Exact frontend origins (add your production domain via the env variable).
CORS_ALLOWED_ORIGINS = _csv_env(
    "CORS_ALLOWED_ORIGINS",
    "https://boardingedu-ewj8l6i4h-shridhanya77s-projects.vercel.app",
)

# Only YOUR Vercel project (production alias + its preview deployments),
# not every *.vercel.app site.
CORS_ALLOWED_ORIGIN_REGEXES = [
    os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^https://boardingedu(-[a-z0-9-]+-shridhanya77s-projects)?\.vercel\.app$",
    )
]
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES.append(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")
    for _host in ("localhost", "127.0.0.1"):
        if _host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_host)

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = _csv_env(
    "CSRF_TRUSTED_ORIGINS",
    ",".join(CORS_ALLOWED_ORIGINS),
)


# ----------------------------------------------------------------------------
# Security / proxy (Railway)
# ----------------------------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True").lower() == "true"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = (
        os.getenv("SECURE_HSTS_INCLUDE_SUBDOMAINS", "True").lower() == "true"
    )
    # Preload is hard to undo, so it is opt-in
    SECURE_HSTS_PRELOAD = os.getenv("SECURE_HSTS_PRELOAD", "False").lower() == "true"

X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"


# ----------------------------------------------------------------------------
# DRF + JWT
# ----------------------------------------------------------------------------
_renderers = ['rest_framework.renderers.JSONRenderer']
if DEBUG:
    # The browsable API builds HTML forms and extra queries; dev only.
    _renderers.append('rest_framework.renderers.BrowsableAPIRenderer')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.DjangoModelPermissionsOrAnonReadOnly',),
    'DEFAULT_RENDERER_CLASSES': _renderers,
    'DEFAULT_PAGINATION_CLASS': 'config.pagination.BoardingEduCursorPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.ScopedRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {
        'counselling': '5/hour',
        'review': '10/hour',
        'enquiry': '10/hour',
    },
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'BoardingEdu API',
    'DESCRIPTION': (
        'School discovery platform API. Covers geography, schools, fees, '
        'admissions, users (JWT auth) and parent reviews.'
    ),
    'VERSION': os.getenv('APP_VERSION', '1.0.0'),
    'SERVE_INCLUDE_SCHEMA': False,
    'SERVE_PERMISSIONS': ['rest_framework.permissions.AllowAny'],
    'SERVE_AUTHENTICATION': [],
    'COMPONENT_SPLIT_REQUEST': True,
    'SORT_OPERATIONS': False,
    'SCHEMA_PATH_PREFIX': '/api',
    'SWAGGER_UI_SETTINGS': {'persistAuthorization': True},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# ----------------------------------------------------------------------------
# Cache / sessions / Celery
# ----------------------------------------------------------------------------
# Redis is used only when REDIS_URL is explicitly set. No probing at startup,
# so a brief Redis hiccup during boot can no longer silently switch the app to
# per-process memory caches and run Celery tasks inside web requests.
REDIS_URL = os.getenv("REDIS_URL", "").strip()
REDIS_IS_AVAILABLE = bool(REDIS_URL)

if REDIS_IS_AVAILABLE:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "SOCKET_CONNECT_TIMEOUT": 2,
                "SOCKET_TIMEOUT": 2,
                "IGNORE_EXCEPTIONS": True,  # cache outage must not take the API down
            },
            "KEY_PREFIX": "boardingedu",
        }
    }
    SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"
    SESSION_CACHE_ALIAS = "default"
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "boardingedu-fallback-cache",
            "KEY_PREFIX": "boardingedu",
        }
    }
    SESSION_ENGINE = "django.contrib.sessions.backends.db"

SESSION_COOKIE_AGE = 60 * 60 * 24 * 14

CELERY_BROKER_URL = REDIS_URL or "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ALWAYS_EAGER = not REDIS_IS_AVAILABLE
CELERY_TASK_EAGER_PROPAGATES = True


# ----------------------------------------------------------------------------
# Logging / Sentry
# ----------------------------------------------------------------------------
LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO").upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
        "json": {
            "format": (
                '{{"time": "{asctime}", "level": "{levelname}", '
                '"logger": "{name}", "message": "{message}"}}'
            ),
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose" if DEBUG else "json",
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}

SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        environment=os.getenv("SENTRY_ENVIRONMENT", "development" if DEBUG else "production"),
        release=os.getenv("APP_VERSION", "1.0.0"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
        send_default_pii=False,
    )