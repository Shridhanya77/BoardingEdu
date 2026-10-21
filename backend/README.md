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

## School image uploads

School logos, campus images, and gallery photos uploaded through the Django
admin are sent to Cloudinary. Configure these server-side environment
variables; do not commit the credentials:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SCHOOL_IMAGE_HOST` (defaults to `images.boardingedu.com`)

Configure `SCHOOL_IMAGE_HOST` as a Cloudinary custom delivery domain and add
the corresponding DNS/CNAME record before enabling uploads. The upload flow
rejects files other than JPG, PNG, or WebP and limits files to 10 MB. Missing
credentials or provider errors are surfaced to the admin; files are not stored
locally as a fallback.
