# Deploy BoardingEdu (Render API/database + Vercel frontend)

Deploy the Render PostgreSQL database and Django API first, then the Vercel
frontend. The API already in use is `https://boardingedu-backend.onrender.com`.
Set the Vercel API URL before building the frontend. The Next.js frontend
proxies browser API requests through its own origin.

## 1. Render — PostgreSQL and Django API

`render.yaml` at the repository root is the blueprint. In the Render dashboard,
choose **New → Blueprint** and connect this repository. It creates:

| Resource | Name |
|---|---|
| PostgreSQL 16 | `boardingedu-db` |
| Key Value (Redis) | `boardingedu-redis` |
| Web service | `boardingedu-backend` (root directory `backend`) |

Build command: `chmod +x ./build.sh && ./build.sh`  
Start command: `bash ./start.sh` (collects static files, migrates, then runs Gunicorn)  
Health check: `/healthz`

If the web service already exists, set those same commands on it instead of creating a second service. Point `DATABASE_URL` at the Render database **Internal Database URL**. Leave `DATABASE_SSL_REQUIRE` empty: hosts ending in `.render.com` use TLS, and Render's private hostname does not. Do not copy a `REDIS_URL` from Railway — the blueprint provisions its own `boardingedu-redis` service and injects `REDIS_URL` from it. Redis backs the Django cache, sessions and DRF throttling; without it the app falls back to per-process memory caches and rate limits are not shared across instances. The blueprint stores OTP codes in the database (`OTP_BACKEND=database`).

Set these on the web service. Do not commit the secret values:

| Key | Value |
|---|---|
| `SECRET_KEY` | A generated, private Django secret |
| `DEBUG` | `False` |
| `DATABASE_URL` | Render Postgres internal connection string |
| `CORS_ALLOWED_ORIGINS` | `https://boardingedu-bay.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | `https://boardingedu-bay.vercel.app` |
| `FRONTEND_URL` | `https://boardingedu-bay.vercel.app` |
| `PUBLIC_SITE_URL` | `https://www.boardingedu.com` |
| `PUBLIC_FRONTEND_URL` | `https://boardingedu-bay.vercel.app` |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare account ID for the R2 media bucket |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 token with Object Read & Write permission scoped to the configured bucket (uploads require write access) |
| `CLOUDFLARE_R2_BUCKET` | Bucket name |
| `CLOUDFLARE_R2_PUBLIC_BASE` | Public bucket URL ending in `/schools` |
| `BREVO_API_KEY` | A Brevo API key (`xkeysib-...`) if verification email should send |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | Verified sender |

`RENDER_EXTERNAL_HOSTNAME` is provided by Render and is added to `ALLOWED_HOSTS` and trusted CSRF origins. Upload school images to the R2 bucket under `schools/<filename>`. Render's filesystem is ephemeral and is not media storage.

Open `https://boardingedu-backend.onrender.com/api/` after the deploy. It should return the API root. Open `https://boardingedu-backend.onrender.com/healthz` for the liveness check. Create an administrator from the Render shell with `python manage.py createsuperuser` if you need Django admin access.

## 2. Vercel — frontend

1. Import the repository into Vercel.
2. Set **Root Directory** to `frontend` and framework to Next.js.
3. Add this environment variable for Production (and Preview if those builds
   should call the API):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | `https://boardingedu-backend.onrender.com/api` |

   The frontend that is deployed is `https://boardingedu-bay.vercel.app`.

   Include `/api` and do not add a trailing slash. The frontend calls Django
   through its same-origin `/backend-api/` rewrite, avoiding browser CORS
   failures for production and preview deployments.

4. Redeploy Vercel after setting the variable. `NEXT_PUBLIC_API_BASE` is
   embedded in the frontend build, so changing it without redeploying will not
   update an existing deployment.

## 3. Verify the deployment

1. `https://boardingedu-backend.onrender.com/api/` responds successfully.
2. The Render service log shows `migrate` finishing, and `/healthz` returns `{"status":"ok"}`.
3. The Vercel site loads data. In browser DevTools → Network, frontend API
   requests should target the Vercel site's `/backend-api/` path and return
   successful responses. Next.js forwards those requests to Django server-side.

If browser API requests go directly to `YOUR-API-DOMAIN` and fail with CORS,
the loaded frontend is an older build that does not use the same-origin proxy.
Deploy the current frontend source and redeploy Vercel; `NEXT_PUBLIC_API_BASE`
is embedded at build time.

If a Vercel deployment URL returns `410 GONE` with a message that the
deployment was removed, that deployment cannot be restored by changing API
settings. Deploy a new Vercel build and use its active URL (or the configured
production domain).

If `/backend-api/` requests fail with a server error, check the Render API
service and its logs. A suspended service, including the old
`boardingedu-6ng7.onrender.com` service, cannot serve data.

If the Vercel directory reports `API 500 on /schools/schools/` while
geography and board endpoints still respond, inspect the Render Django logs
for the failing request and verify the deployed backend is from the same code
revision as the frontend. School model changes require the migrations shipped
with that backend revision. From the Render shell, check
`python manage.py showmigrations schools admissions` and run
`python manage.py migrate --noinput` if migrations are pending. `bash ./start.sh`
runs that migrate command on every boot. Confirm the latest Render build
completed successfully before redeploying Vercel.
The school image fields require `schools.0004_add_school_logo_url` and
`schools.0005_add_school_image_url`. School detail galleries require
`schools.0006_schoolphoto` and `schools.0007_schoolphoto_category_schoolvideo`;
add photo and video URLs from a school's Django admin page. Per-item fee
frequencies require `fees.0002_feeitem_payment_frequency` and `fees.0003_alter_feeitem_amount`.
The latter allows variable fees to have no fixed amount. In Django Admin,
open a school and use its Fees panel to create an academic-year structure.
Add fee components in the structure's inline, choose the grade and payment
frequency for each, then set the structure to active and published. Variable
or distance-based items can leave the amount blank; the profile presents these
as Dynamic. Only active, published structures appear on school profiles.
Counselling submissions require `admissions.0003_counsellingrequest`.

## 4. Backup & disaster recovery

BoardingEdu has three stateful dependencies. Each has a different recovery
model, so treat them separately.

| Dependency | State | Backup | Recovery |
|---|---|---|---|
| Render PostgreSQL (`boardingedu-db`) | All relational data: users, schools, fees, applications, enquiries | Render automated daily backups (paid plans) + offsite `pg_dump` | Restore snapshot or `pg_restore` a dump into a fresh instance |
| Cloudflare R2 bucket | School images and uploaded media | R2 object versioning / lifecycle rules; the bucket is the source of truth | Re-point the bucket; objects are content-addressed and idempotent |
| Render Redis (`boardingedu-redis`) | Cache, sessions, Celery broker | None needed | Ephemeral by design — a restart only drops cached data and forces session re-login |

`OTP_BACKEND=database` means one-time codes survive a Redis loss. Do **not**
switch OTP to Redis on Render; Redis is treated as disposable.

### Recovery objectives

- **RPO (max data loss):** ≤ 24 h with Render's automatic daily backups. Reduce
  to hours by scheduling a daily offsite `pg_dump` (below).
- **RTO (time to restore):** ≤ 1 h once a dump or snapshot is available.

### Take an offsite backup

Run from a machine with the Render **External Database URL** (never commit it):

```powershell
$env:PGDATABASE_URL = "<render-external-database-url>"
pg_dump --no-owner --no-privileges --format=custom --file "boardingedu-$(Get-Date -Format yyyyMMdd-HHmm).dump" $env:PGDATABASE_URL
```

Store the dump in an access-controlled location (e.g. an R2 bucket with a
`private/` prefix) and keep at least 30 daily copies. A backup that only lives
next to the database it protects is not a backup.

### Restore into a fresh database

1. Provision a new Render PostgreSQL instance (or empty database).
2. Copy its **External Database URL**.
3. Restore the most recent dump:

   ```powershell
   pg_restore --no-owner --no-privileges --clean --if-exists --dbname "<new-external-database-url>" "boardingedu-YYYYMMDD-HHMM.dump"
   ```

4. Point the `boardingedu-backend` service's `DATABASE_URL` at the restored
   instance and redeploy. `start.sh` runs `migrate` on boot, which will no-op
   when the restored schema is current and apply any missing migrations
   otherwise.
5. Confirm `/readyz` reports the database and search subsystems as healthy, then
   load a school listing and a school profile in the browser.

If the restore target already has rows, prefer `--clean --if-exists` (as above)
or restore into an empty database and swap `DATABASE_URL` afterwards.

### Recovering from a Redis outage

Redis is not authoritative. On a Redis incident:

1. Confirm the `REDIS_URL` value is still injected (Blueprint → web service →
   Environment).
2. Restart the service; sessions rebuild and DRF throttle counters reset.
3. Expect users to re-authenticate (cached sessions were dropped) and Celery
   tasks to resume once the broker is reachable.

Because `IGNORE_EXCEPTIONS` is enabled, a Redis outage degrades the cache but
does not 500 the API.

### Recovering from an accidental deletion / bad migration

1. Take a fresh dump **before** repairing anything.
2. Restore the last known-good dump into a scratch database.
3. Diff the affected tables, then replay only the missing rows into production.
4. If the whole dataset is compromised, promote the scratch restore by
   swapping `DATABASE_URL` per the restore steps above.

### Post-incident checks

- Rotate `SECRET_KEY`, database credentials, R2 keys and `BREVO_API_KEY` if the
  incident involved credential exposure.
- Purge any secrets that were committed to git (use `git filter-repo` and force
  push with team sign-off) and confirm the CI `pip-audit` / `npm audit` jobs are
  still green.

## Local development

After configuring `backend/.env`, apply pending database migrations before
starting the Django server. This is required whenever a backend update adds
tables or columns used by the school directory:

```powershell
cd backend
.\venv\Scripts\python.exe manage.py migrate
```

| Frontend | Backend |
|---|---|
| `frontend/.env.local`: `NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api` | `backend/.env`: `DEBUG=True`, local `DATABASE_URL` |
