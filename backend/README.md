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
public image URLs. Upload files to a storage provider of your choice and paste
the resulting URL into the corresponding field. This project does not upload,
store, or serve school image files.
