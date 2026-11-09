# BoardingEdu backend operations

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

## Email verification and notifications

Set `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL`, and `FRONTEND_URL` in the backend
environment. `EMAIL_PROVIDER=resend` selects the Resend HTTP API; keep the API
key on the backend only. Registration and OTP delivery require a configured
sender. Apply migrations with `python manage.py migrate`.

The public verification endpoints are:

- `POST /api/notifications/send-otp/` and `/api/notifications/resend-otp/`
  with `{"email":"parent@example.com"}`
- `POST /api/notifications/verify-otp/` with
  `{"email":"parent@example.com","otp":"123456"}`

Verification codes expire after five minutes, are single-use, and are stored
only as keyed hashes. Send/resend responses intentionally do not disclose
whether an account exists. Parent and school-admin JWT access requires verified
email; school approval remains a separate workflow. Existing `STAFF_ADMIN` and
`SUPER_ADMIN` permissions are not changed.

When Redis is configured, non-critical notifications use Celery. Run a worker
alongside the web process with:

```powershell
celery -A config worker --loglevel=info
```

Delivery records distinguish pending, provider-accepted, delivered, failed,
and bounced states. For Resend delivery/bounce callbacks, set
`RESEND_WEBHOOK_SECRET` and configure Resend to POST its signed webhook events
to `/api/notifications/resend-webhook/`. A provider-accepted email is not
reported as delivered until a valid webhook event arrives.

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
