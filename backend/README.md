# BoardingEdu backend operations

## Local development on Windows

Start the backend from PowerShell in the `backend` directory:

```powershell
.\start-local.ps1
```

The script uses the backend virtual environment when available, overrides
`DATABASE_URL` for that process with the ignored local `db.sqlite3`, applies
migrations, and starts Django at `http://127.0.0.1:8000/`. It does not change
the `.env` file or connect to its configured database. Keep the server running
while using the frontend; its local API base should be
`http://127.0.0.1:8000/api`. The local database starts empty, so schools and
other records must be seeded or restored locally when needed.

## School verification

Apply the school verification audit migration before using the verification
endpoints:

```powershell
python manage.py migrate
```

Staff Admin and Super Admin roles can use:

- `GET /api/schools/schools/verification-queue/`
- `POST /api/schools/schools/{school_id}/verification/` with `status` and a
  required `note`
- `GET /api/schools/schools/{school_id}/verification-history/`

Each status change is recorded with its actor, previous and new status, note,
and timestamp. Generic school edits cannot change the verification status.
The Django admin has a paginated pending-verification queue linked from the
school list, and exposes the audit history as read-only.

## School content approval

School-admin edits to the public profile, facilities, grades, fee items and
publication status, photographs, brochures, and admission documents are stored
as pending submissions. The current approved version remains public until a
Super Admin approves a submission in **Review school changes** from the Django
admin overview. Rejecting a submission leaves the public content unchanged.
School admins can continue managing leads and account/subscription settings
without putting those private operational changes through public-content
review.

## Transactional email notifications

Set `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL`, and `FRONTEND_URL` in the backend
environment. `EMAIL_PROVIDER=resend` selects the Resend HTTP API; keep the API
key on the backend only. `DEFAULT_FROM_EMAIL` must use a sender/domain verified
in Resend, and `FRONTEND_URL` should be the deployed frontend origin. Email
delivery is used for transactional notifications, not account registration.
Parent and school-admin accounts can sign in without email OTP verification;
school approval remains a separate workflow. Apply migrations with
`python manage.py migrate`.

Delivery records distinguish pending, provider-accepted, delivered, failed,
and bounced states. Check the `EmailDelivery` record status and `error_code`,
plus backend logs, when diagnosing notification delivery; provider-accepted
emails can still bounce.

When Redis is configured, notifications use Celery. Run a worker
alongside the web process with:

```powershell
celery -A config worker --loglevel=info
```

Delivery records distinguish pending, provider-accepted, delivered, failed,
and bounced states. For Resend delivery/bounce callbacks, set
`RESEND_WEBHOOK_SECRET` and configure Resend to POST its signed webhook events
to `/api/notifications/resend-webhook/`. A provider-accepted email is not
reported as delivered until a valid webhook event arrives.

## Meilisearch school autocomplete

The public school autocomplete uses Meilisearch when `MEILI_URL` is configured.
Location suggestions continue to use the database, and school suggestions fall
back to the database if Meilisearch is unreachable or its index is unavailable.
School saves, deletes, and board/school-type changes update the index after the
database transaction commits.

Start the local search service from the repository root with:

```powershell
docker compose up -d meilisearch
```

Set `MEILI_URL` to `http://localhost:7700` when the backend runs on the host, or
`http://meilisearch:7700` when it runs in the Compose network. Set
`MEILI_MASTER_KEY` to the Meilisearch master key when authentication is enabled.
After the backend environment is configured, build or refresh the index from
the `backend` directory:

```powershell
python manage.py rebuild_school_search_index
```

Run this command after first deployment, after changing the index configuration,
or if the index needs to be rebuilt. `MEILI_INDEX_UID` defaults to `schools`.

## School images

School logo, campus image, and gallery image fields in the Django admin accept
image URLs. The API rewrites school media URLs to `/media/schools/<filename>`
and serves those images from Cloudflare R2; it does not accept file uploads or
store media on the application filesystem. Configure the `CLOUDFLARE_R2_*`
variables listed in `.env.example` and upload each image to the bucket at
`schools/<filename>`, matching the filename in the school record. Railway's
local filesystem is ephemeral and should not be used for persistent images.

To manage school images, run this command from the `backend` directory:

```powershell
python manage.py manage_school_photos
```

Choose **Add image** to enter a public HTTPS URL for a cover, logo, or gallery
photo. Gallery photos are assigned a category (Campus, Classroom, Sports,
Library, Hostel, or Other), with optional caption and alt text. The command
downloads and validates the image, converts it to WebP (maximum 1600 px,
quality 80), applies the BoardingEdu watermark to gallery photos only, uploads
it to the `schools/` prefix in Cloudflare R2, and updates the school's image
record. Cover and logo images are optimized without a watermark.
Every upload is confirmed before it is sent to R2. The watermark image is
included at `backend/static/admin/img/boardingedu-watermark-transparent.png`.

You can pass `--school "school name"`, a school code, or a slug to search
directly. You can also add one image without the add-image prompts:

```powershell
python manage.py manage_school_photos --school "School Name" --cover-url "https://example.com/cover.jpg"
python manage.py manage_school_photos --school "School Name" --logo-url "https://example.com/logo.png"
python manage.py manage_school_photos --school "School Name" --gallery-url "https://example.com/library.jpg" --category LIBRARY --caption "Library"
```

Configure the `CLOUDFLARE_R2_*` values in `backend/.env` before uploading.
Hiding a gallery photo marks its database record inactive; it does not delete
the image from R2. Replacing a cover or logo uploads a new uniquely named object
and leaves the previous R2 object untouched.
