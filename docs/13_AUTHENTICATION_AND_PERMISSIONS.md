# 13. Authentication and permissions

## Account roles

The canonical application role is `User.role`:

| Role | Intended access |
| --- | --- |
| `PARENT` | Own profile, children, shortlists, searches, enquiries, reviews, and applications |
| `SCHOOL_ADMIN` | One school after verification, subject to approval rules |
| `STAFF_ADMIN` | Platform queues, CRM, moderation, and assigned operational work |
| `SUPER_ADMIN` | Highest application role and all staff-level operations |

Public visitors are unauthenticated and do not have a `User.role`.

Django users have a separate `is_superuser` and `is_staff` concept. It is possible for API role and Django Admin capability to disagree; normal production operation should align `SUPER_ADMIN` and Django superuser for the owner.

## Login and tokens

- `POST /api/auth/jwt/token/` accepts email or username.
- Access lifetime is 15 minutes.
- Refresh lifetime is 7 days.
- Refresh-token rotation and blacklist are enabled.
- School-admin refresh is revalidated by verification status.
- Login and registration may use email OTP or database OTP state.
- OTP protects resend cooldown, expiry, attempts, and optional Redis/database throttles.

The frontend stores and refreshes tokens through its configured tokens provider. An authenticated API request retries once after a 401 if a refresh token is available.

## Public visitor matrix

| Capability | Visitor |
| --- | --- |
| Browse active school catalogue | Allowed |
| School detail and fees | Allowed according to publication flags |
| Search suggestions | Allowed |
| Create guest enquiry/counselling lead | Allowed, throttled |
| Subscribe to blogs | Allowed, throttled |
| Create parent account | OTP/registration flow |
| Read another user’s data | No |
| Record engagement | Allowed with visitor/session dedupe |

## Role matrix

| Area | Visitor | Parent | School Admin | Staff Admin | Super Admin |
| --- | --- | --- | --- | --- | --- |
| Public pages and active schools | Read | Read | Read | Read | Read |
| Own parent profile/children | — | CRUD own | — | Read/bypass in profiles | Read/bypass |
| Own shortlists/saved searches | — | CRUD own | — | Limited by endpoint | Limited by endpoint |
| Own enquiries/applications | — | Own | — | All | All |
| Own-school enquiries | — | — | Own school | All | All |
| Own-school profile changes | — | — | Propose/manage approved fields | View operational records | Approve/reject |
| School facilities/grades/photos/fees | — | — | Own verified school | Direct/all in Django Admin | Direct/all |
| Public catalogue master data | — | — | Read | CRUD through Django/API according to view | CRUD |
| Reviews | Read published | Create, own manage | Own-school scope where exposed | View only | Approve/reject |
| Verification and promotions | — | — | — | Manage | Manage |
| User account and role management | — | — | — | API restrictions apply | Full |
| Django Admin | — | — | Only if Django staff and scoped | Managed operational group; no user/role admin, delete, or review moderation | Superuser: all |

## Permission classes

Important classes in `backend/apps/users/permissions.py`:

- `IsSuperAdmin`
- `IsStaffAdmin`
- `IsPlatformAdmin`
- `IsVerifiedSchoolAdmin`
- `IsSchoolAdmin`
- `IsParent`
- `IsOwnParentProfile`
- `IsOwnSchoolOrHigher`
- `IsOwnChildOrHigher`
- `IsOwnEnquiryOrHigher`

Object-level permissions prevent cross-parent, cross-child, cross-school, and cross-enquiry access where they are applied. Django Admin uses `AssignedSchoolAdminMixin` and `CatalogVisibleToSchoolAdminMixin` for additional scoping.

## Data ownership rules

- Parent tools are scoped to `ParentProfile.user_id`.
- Children belong to a parent profile.
- School enquiries belong to a school and may also belong to a child/parent.
- School admins are scoped to `SchoolAdminProfile.school_id`.
- Staff and super admins have platform scope.
- Public school queries require `status=True`; public detail and media hide inactive records.

## Security controls implemented

- Password reset and password change endpoints.
- JWT signing, rotation, verification, and blacklist.
- OTP expiry, resend cooldown, attempt limits, and cooldown/rate throttles.
- CORS and CSRF origins configured from environment.
- Django security middleware and security headers.
- Scoped engagement, registration, review, enquiry, newsletter, and counselling throttles.
- Parent, school, and enquiry object checks.
- Blog HTML sanitization.
- Private application and profile storage.
- Razorpay and Resend webhook signatures.
- Passwords are handled by Django, not stored in application custom plaintext fields.
- Visitor identity is HMAC-hashed for engagement; raw visitor ID is not saved.

## Implemented versus recommendations

Implemented controls should be monitored but are not proof of end-to-end production testing. Missing or incomplete items include a product-wide admin audit UI, field-level permission testing for every viewset, and a dedicated secrets/permissions review process. The repository currently supports CORS and security headers but does not establish in-code MFA, device management, or parent account deletion.
