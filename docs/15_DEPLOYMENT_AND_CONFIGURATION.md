# 15. Deployment and configuration

## Runtime components

| Component | Repository location | Deployment |
| --- | --- | --- |
| Next.js frontend | `frontend/` | Vercel |
| Django API | `backend/` | Render |
| PostgreSQL | Render blueprint | Render managed database |
| Redis | Render blueprint | Optional cache/broker |
| Celery worker/beat | `config/celery.py` | Not declared by current Render blueprint |
| Cloudflare R2 | Environment variables | Optional media/public delivery |
| Meilisearch | Environment variables | Optional search accelerator |
| Sentry | Environment variables | Optional error reporting |

## Backend build

Render root directory is `backend/`. The build command is `build.sh`; the start command is `start.sh`. The health path is `/healthz`.

The deploy scripts migrate the database and collect static files. `release.sh`, `build.sh`, and `start.sh` should be reviewed before changing deploy behaviour.

## Database

`DATABASE_URL` is preferred. The settings also support legacy `DB_*` variables. PostgreSQL 16 is specified in `render.yaml`.

The local SQLite files and database dumps are development/backups. PostgreSQL is the intended deployed database.

## Frontend

`NEXT_PUBLIC_API_BASE` selects the Django API origin. In production, the code requires this value unless it has no configured host. A retired Railway URL is ignored and falls back to the Render API URL.

Browser API calls to the backend go through `/backend-api/[[...path]]/route.ts`, which proxies the configured API to keep CORS and base-path handling centralized.

Vercel routes and deployment settings are in `frontend/vercel.json` and the root `vercel.json`.

## Redis

Redis, when `REDIS_URL` is usable, supplies:

- Django cache
- sessions
- DRF throttling state
- Celery broker/result backend

Without Redis, Django uses local/process memory caches and Celery eager mode.

The settings reject clearly unusable Railway `.internal` Redis hosts unless `RAILWAY_ENVIRONMENT` is set, preventing copied Railway configuration from producing a Render startup hang.

## Celery

Celery modules:

- `backend/config/celery.py`
- `backend/apps/schools/tasks.py`
- `backend/apps/notifications/tasks.py`

When Redis is configured, the intended commands are:

```text
celery -A config worker --loglevel=info
celery -A config beat --loglevel=info
```

No worker or beat service is in `render.yaml`. Deployment must add both services or move tasks to a provider scheduler before scheduled features are production-verified.

## Media

Cloudflare R2 variables support both short names and `CLOUDFLARE_R2_*` names:

- account ID
- access key ID
- secret access key
- bucket
- public domain/base

School URL fields remain URL strings. Public media routes proxy or stream configured R2 objects. Blog and private application uploads use Django storage configuration.

## Email

`EMAIL_PROVIDER` supports Brevo, Resend, or Cloudflare email. `OTP_EMAIL_PROVIDER=auto` is also supported. The blueprint configures Brevo and leaves credentials as Render secrets.

Provider-related settings include:

- sender address/name
- provider API credentials
- Resend webhook secret
- unsubscribe and notification behavior

The repository does not contain credentials or secret values.

## Search

Meilisearch variables:

- `MEILI_URL`
- `MEILI_MASTER_KEY`
- `MEILI_INDEX_UID`

Search signals update the index for school changes. SQL search remains a fallback or alternative.

## Security and host settings

Environment settings control:

- `SECRET_KEY`
- `DEBUG`
- allowed hosts
- CORS origins
- CSRF trusted origins
- frontend/public site URLs
- HTTPS and proxy behavior
- optional Sentry DSN

Production should use HTTPS and a restricted CORS/CSRF origin set. `render.yaml` currently lists the current frontend domain and a Vercel wildcard regex.

## Operational URLs

- API health: `/healthz`
- API readiness: `/readyz`
- Django API root: `/api/`
- Django Admin: `/admin/`
- API schema: `/api/schema/swagger-ui/`

## Environment example

Backend variables are documented in `backend/.env.example`. It is safe to use as a variable inventory, but users should replace names and values only in their local environment or secret manager.
