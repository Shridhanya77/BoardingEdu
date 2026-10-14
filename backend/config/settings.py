import os
import dj_database_url
from dotenv import load_dotenv
load_dotenv()
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing.")

DEBUG = os.getenv("DEBUG", "False").lower() == "true"



ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv(
        "ALLOWED_HOSTS",
        "localhost,127.0.0.1,boardingedu-production-4144.up.railway.app,boardingedu-6ng7.onrender.com"
    ).split(",")
    if host.strip()
]


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # 3rd Party (YOUR STACK DECISIONS)
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    # Local Apps
    'apps.geography.apps.GeographyConfig',
    'apps.schools.apps.SchoolsConfig',
    'apps.fees.apps.FeesConfig',
    'apps.admissions.apps.AdmissionsConfig',
    'apps.users.apps.UsersConfig',
    'apps.search.apps.SearchConfig'
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # MUST BE FIRST
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True, 'OPTIONS': {'context_processors': ['django.template.context_processors.debug','django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages'],},},]
WSGI_APPLICATION = 'config.wsgi.application'

# YOUR DATABASE DECISION: PostgreSQL
# PostgreSQL database configuration
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. Configure it in your environment."
    )

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=os.getenv("DATABASE_SSL_REQUIRE", str(not DEBUG)).lower() == "true",
    )
}

AUTH_PASSWORD_VALIDATORS = [{'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},{'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},{'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},{'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},]
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'users.User'

def _csv_env(name, default=""):
    return [
        value.strip().rstrip("/")
        for value in os.getenv(name, default).split(",")
        if value.strip()
    ]


# Comma-separated frontend origins, e.g. the production Vercel URL.

CORS_ALLOWED_ORIGIN_REGEXES = _csv_env(
    "CORS_ALLOWED_ORIGIN_REGEXES",
    r"^https://[a-z0-9-]+\.vercel\.app$",
)

CORS_ALLOW_CREDENTIALS = True

if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES.extend(
        [r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"]
    )
    for _host in ("localhost", "127.0.0.1"):
        if _host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_host)

RENDER_EXTERNAL_HOSTNAME = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)


# Allowed frontend origins
CORS_ALLOWED_ORIGINS = [
    "https://boardingedu-ewj8l6i4h-shridhanya77s-projects.vercel.app",
    # keep any other existing origins
]


CORS_ALLOW_CREDENTIALS = True

# Add trusted origins for Django CSRF protection
CSRF_TRUSTED_ORIGINS = _csv_env(
    "CSRF_TRUSTED_ORIGINS",
    ",".join(CORS_ALLOWED_ORIGINS)
)

# Railway reverse proxy configuration
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

if not DEBUG:
    SECURE_SSL_REDIRECT = (
        os.getenv("SECURE_SSL_REDIRECT", "True").lower() == "true"
    )
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True


# YOUR DRF + JWT AUTH DECISION (WITH TOKEN ROTATION)
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.DjangoModelPermissionsOrAnonReadOnly',),
    'DEFAULT_PAGINATION_CLASS': 'config.pagination.BoardingEduCursorPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend','rest_framework.filters.SearchFilter','rest_framework.filters.OrderingFilter',],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,  # YOUR TOKEN ROTATION DECISION
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://localhost:6379/0"
)

def _redis_available(redis_url: str) -> bool:
    try:
        import socket as _socket
        from urllib.parse import urlparse as _urlparse

        parsed = _urlparse(redis_url)
        host = parsed.hostname or 'localhost'
        port = parsed.port or 6379
        timeout = 0.3
        with _socket.create_connection((host, port), timeout=timeout):
            pass
        return True
    except OSError:
        return False
    except Exception:
        return False


REDIS_IS_AVAILABLE = _redis_available(REDIS_URL)

if REDIS_IS_AVAILABLE:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
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
    SESSION_CACHE_ALIAS = "default"

SESSION_COOKIE_AGE = 60 * 60 * 24 * 14

# YOUR QUEUE DECISION: Celery + Redis (silently disabled when Redis is offline)
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ALWAYS_EAGER = not REDIS_IS_AVAILABLE
CELERY_TASK_EAGER_PROPAGATES = True