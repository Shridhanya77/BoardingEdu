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

## School images

School logo, campus image, and gallery image fields in the Django admin accept
image URLs. The API rewrites school media URLs to `/media/schools/<filename>`
and serves those images from Cloudflare R2; it does not accept file uploads or
store media on the application filesystem. Configure the `CLOUDFLARE_R2_*`
variables listed in `.env.example` and upload each image to the bucket at
`schools/<filename>`, matching the filename in the school record. Railway's
local filesystem is ephemeral and should not be used for persistent images.
