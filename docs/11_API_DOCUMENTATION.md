# 11. API documentation

The backend is Django REST Framework. API paths below are relative to `/api/`.

## Authentication conventions

- Public endpoints use `AllowAny` or read-only DRF permissions.
- Protected endpoints accept `Authorization: Bearer <access-token>`.
- JWT login is `POST /api/auth/jwt/token/`.
- Refresh is `POST /api/auth/jwt/token/refresh/`.
- Verify is `POST /api/auth/jwt/token/verify/`.
- Logout/blacklist is `POST /api/auth/jwt/blacklist/`.
- The API root is available at `GET /api/`.
- Interactive schema: `/api/schema/`, `/api/schema/swagger-ui/`, and `/api/schema/redoc/`.

## Authentication and users

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/jwt/token/` | Public | Username or email login. OTP may be required by account state |
| POST | `/api/auth/jwt/token/refresh/` | Public | Rotate refresh token; school-admin login additionally verifies school status |
| POST | `/api/auth/jwt/token/verify/` | Public | Verify an access token |
| POST | `/api/auth/jwt/blacklist/` | Public | Blacklist a refresh token |
| POST | `/api/auth/otp/verify/` | Public | Verify login or registration OTP |
| POST | `/api/auth/otp/resend/` | Public | Resend OTP after cooldown |
| POST | `/api/auth/otp/email/` | Authenticated | Start email-change OTP |
| POST | `/api/auth/otp/email/verify/` | Authenticated | Confirm email change |
| POST | `/api/users/password-reset/` | Public | Request a reset link |
| POST | `/api/users/password-reset/confirm/` | Public | Set a new password from reset data |
| POST | `/api/users/password-change/` | Authenticated | Change the current password |

The `UserViewSet` provides standard list, create, retrieve, update, and delete actions at `/api/users/users/`. Public registration is implemented by the `register` action, not as unrestricted anonymous list/create access. User, parent, school-admin, and staff-admin profile viewsets are mounted under `/api/users/parent-profiles/`, `/api/users/school-admin-profiles/`, and `/api/users/staff-admin-profiles/`.

## Public geography and school catalogue

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/geography/countries/` | Public | Country catalogue |
| GET | `/api/geography/states/` | Public | States, optionally filtered by country |
| GET | `/api/geography/cities/` | Public | Cities, filtered by state/country |
| GET | `/api/geography/locations/` | Public | Localities, filtered by city |
| GET | `/api/schools/boards/` | Public | Board catalogue |
| GET | `/api/schools/school-types/` | Public | Canonical school types |
| GET | `/api/schools/grades/` | Public | Grade catalogue |
| GET | `/api/schools/facilities/` | Public | Facility catalogue |
| GET | `/api/schools/faqs/` | Public | Active directory FAQs |

Catalogue writes require platform-administrator permission where the viewset exposes mutations. `SchoolType` and `SchoolFAQ` are read-only.

## Schools

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/schools/schools/` | Public/role-aware | Paginated public directory for active schools |
| GET | `/api/schools/schools/{id}/` | Public/role-aware | School detail |
| GET | `/api/schools/schools/by-slug/{slug}/` | Public | Retrieve by SEO slug |
| GET | `/api/schools/schools/popular/` | Public | Schools ordered by calculated popularity |
| GET/PATCH | `/api/schools/schools/mine/` | Verified school admin | Own school profile and proposed updates |
| POST | `/api/schools/schools/register/` | Public, throttled | Create pending school and school-admin account |
| GET | `/api/schools/schools/verification-queue/` | Staff/Super | Pending verification records |
| GET | `/api/schools/schools/{id}/verification-history/` | Staff/Super | Verification event history |
| POST | `/api/schools/schools/{id}/verification/` | Staff/Super | Set verification status and add an audit note |
| POST/PUT/PATCH/DELETE | `/api/schools/schools/` and `/{id}/` | Platform admin | Direct school create/update/delete |
| GET | `/api/schools/school-facilities/` | Public/role-aware | School-facility links |
| GET | `/api/schools/school-grades/` | Public/role-aware | Grades offered by schools |
| POST | `/api/schools/engagement/` | Public, throttled | Record view, listing click, or compare event |

List-query options include directory search text, board, type, state, city, locality, gender, tuition range, annual fee, featured, home category, and ordering. Public detail requests hide inactive schools.

## Fees

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/fees/academic-years/` | Public | Academic-year list |
| GET | `/api/fees/fee-terms/` | Public | Fee terms |
| GET | `/api/fees/fee-structures/` | Public/role-aware | Published and permitted fee structures |
| GET | `/api/fees/fee-items/` | Public/role-aware | Fee line items |
| GET | `/api/fees/public-estimates/` | Public | Fee calculator estimate |

The frontend uses dashboard school-operations routes for school-admin proposals instead of direct fee-publication writes.

## Admissions

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET/POST | `/api/admissions/children/` | Authenticated parent | List/create children; object access is owned |
| GET/PATCH/DELETE | `/api/admissions/children/{id}/` | Owner or higher role | Manage one child |
| GET/POST | `/api/admissions/enquiries/` | Public create; authenticated read | Guest or parent admission enquiries |
| GET/PATCH/DELETE | `/api/admissions/enquiries/{id}/` | Parent, school, or staff scope | Read/update enquiry according to role |
| POST | `/api/admissions/counselling-requests/` | Public, throttled | Submit a counselling lead |
| GET | `/api/admissions/applications/` | Parent | List own applications |
| GET | `/api/admissions/applications/{enquiry_id}/` | Parent owner | Application detail and timeline |
| POST | `/api/admissions/applications/{enquiry_id}/withdraw/` | Parent owner | Withdraw one application |
| POST | `/api/admissions/applications/{enquiry_id}/documents/` | Parent owner | Upload a private document |
| GET | `/api/admissions/applications/{enquiry_id}/documents/{document_id}/file/` | Owner or reviewer | Download private document |
| PATCH | `/api/admissions/applications/{enquiry_id}/documents/{document_id}/review/` | School/staff reviewer | Update document verification |
| GET/POST | `/api/admissions/applications/{enquiry_id}/messages/` | Application participant | Read/send application messages |
| GET/PATCH | `/api/admissions/notifications/` and `/notifications/{id}/read/` | Parent | In-app notifications |
| GET/PATCH | `/api/admissions/profile/` | Parent | Parent profile |
| POST/DELETE | `/api/admissions/profile/photo/` | Parent | Profile photo |

## Reviews

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/reviews/` | Public; parent/school-admin scoped | Approved public reviews; parents can also see their own statuses and school admins see only assigned-school reviews |
| POST | `/api/reviews/` | Authenticated parent | Create a `PENDING` review |
| GET | `/api/reviews/{id}/` | Public/role scoped | Retrieve an approved review, own parent review, or assigned-school review |
| POST | `/api/reviews/{id}/approve/` | Super Admin only | Approve a pending review and record moderator/time |
| POST | `/api/reviews/{id}/reject/` | Super Admin only | Reject a pending review and record moderator/time |

A parent can have at most one review per school. Status is `PENDING`, `APPROVED`, or `REJECTED`. Review content cannot be updated or deleted through the API. PATCH, PUT, and DELETE return HTTP 403.

## Search and content

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/search/suggestions/` | Public | School, place, and content suggestions |
| GET | `/api/guides/articles/` | Public | Guide catalogue |
| GET | `/api/guides/articles/{slug}/` | Public | One published guide |
| GET | `/api/blogs/` | Public | Blog list |
| GET | `/api/blogs/featured/` | Public | Featured posts |
| GET | `/api/blogs/latest/` | Public | Latest posts |
| GET | `/api/blogs/search/` | Public | Blog search |
| POST | `/api/blogs/subscribe/` | Public, throttled | Newsletter subscription |
| GET | `/api/blogs/preview/{slug}/` | Staff/Super with preview access | Draft preview |
| GET | `/api/blogs/category/{slug}/` | Public | Posts by category |
| GET | `/api/blogs/{slug}/` | Public | Published post |
| GET | `/api/blog-categories/` | Public | Blog categories |

## Dashboards and school operations

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/dashboards/public/summary/` | Public | Public platform totals |
| GET | `/api/dashboards/parent/` | Parent | Parent dashboard aggregates |
| GET/POST/DELETE | `/api/dashboards/parent/shortlist/` | Parent | Manage shortlists |
| GET/POST/PATCH/DELETE | `/api/dashboards/parent/saved-searches/` | Parent | Manage saved alerts |
| GET/DELETE | `/api/dashboards/parent/recently-viewed/` | Parent | Recently viewed schools |
| GET | `/api/dashboards/school/` | School admin/Staff/Super | School dashboard |
| PATCH | `/api/dashboards/school/enquiries/{id}/status/` | School or higher role | Update CRM status |
| POST/PATCH/DELETE | `/api/dashboards/school/facilities/` | Verified school admin or higher | Create or propose facility links |
| POST/PATCH/DELETE | `/api/dashboards/school/grades/` | Verified school admin or higher | Create or propose grades |
| POST/PATCH/DELETE | `/api/dashboards/school/photos/` | Verified school admin or higher | Create or propose photos |
| POST/PATCH/DELETE | `/api/dashboards/school/admission-resources/` | Verified school admin or higher | Create or propose resources |
| POST/PATCH/DELETE | `/api/dashboards/school/fees/items/` | Verified school admin or higher | Create or propose fees |
| POST | `/api/dashboards/school/fees/{id}/publish/` | School admin/staff/super | Queue or publish according to role |
| GET | `/api/dashboards/staff-admin/` | Staff/Super | Staff dashboard |
| GET | `/api/dashboards/admin/` | Staff/Super | Main platform dashboard |

## Notifications and subscriptions

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET/PUT/PATCH | `/api/notifications/preferences/` | Authenticated | Email notification preferences |
| POST | `/api/notifications/unsubscribe/{token}/` | Public | Unsubscribe by opaque token |
| POST | `/api/notifications/resend-webhook/` | Resend signature | Email delivery status webhook |
| GET | `/api/subscriptions/plans/` | Public | Subscription plans |
| GET | `/api/subscriptions/mine/` | Authenticated school/admin | Current subscription |
| POST | `/api/subscriptions/orders/` | School admin | Create Razorpay order |
| POST | `/api/subscriptions/verify/` | School admin | Verify payment signature |
| POST | `/api/subscriptions/webhook/` | Razorpay signature | Provider webhook |

## Health and media

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/healthz` | Public | Process liveness |
| GET | `/readyz` | Public | Readiness, including database and optional Redis |
| GET | `/admin/` | Django staff/superuser | Django administration |
| GET | `/media/schools/{filename}` | Public | Proxied public school media |
| GET | `/media/day-schools/{filename}` | Public | Compatibility day-school media route |
