# 12. User workflows

This document describes verified code paths, not hypothetical screens.

## 1. Visitor finds a school

1. Opens `/schools/...` or a generated location/board route through the catch-all frontend page.
2. The frontend reads URL segments and calls the school and geography APIs.
3. `/api/schools/schools/` returns active public schools.
4. Cards show name, location, board, type, fees, rating, and media.
5. Selecting a card opens `/school/{slug}` or the matching frontend route.
6. The detail page calls `by-slug`, fee, photo, facility, review, FAQ, and popularity-related endpoints.
7. The client records `SCHOOL_VIEW` through `/api/schools/engagement/`.

## 2. Visitor filters schools

1. The listing page reads filter controls into URL state.
2. It calls `/api/schools/schools/` with query parameters.
3. Django applies geography validation, search, board/type, gender, fee, featured, and ordering filters.
4. The response is a cursor or offset page according to the view.
5. Empty and loading states render locally.
6. Adding a school to a browser comparison may also record `COMPARE_ADD`.

## 3. Parent registers

1. The parent enters registration details on `/signup/`.
2. Frontend calls the public registration endpoint or OTP workflow exposed by the user API.
3. Backend validates fields, creates a `User(role=PARENT)`, and creates the related parent profile.
4. Email verification/OTP state is stored and a delivery is attempted.
5. Verification unlocks login; successful JWT login creates access and refresh tokens.

If OTP delivery fails, account or login state can remain blocked by the OTP requirement.

## 4. Parent adds a child

1. The parent opens `/dashboard/parent/children`.
2. Frontend calls `POST /api/admissions/children/`.
3. The parent profile is taken from the authenticated account.
4. A `Child` row is created with optional grade and profile fields.
5. The parent dashboard reads children again and updates the display.

## 5. Parent shortlists a school

1. Parent uses shortlist control on a card or profile.
2. Frontend sends `POST /api/dashboards/parent/shortlist/`.
3. Backend finds the parent profile and active public school.
4. It creates `ParentShortlist`; duplicate saves are prevented.
5. Removing sends `DELETE /api/dashboards/parent/shortlist/`.

The shortlist action is also a separate engagement event; implement or verify the frontend call before considering it complete in end-to-end tracking.

## 6. Parent compares schools

1. Visitor or parent adds at least two schools to browser comparison state.
2. `/compare/` renders side-by-side fields.
3. Frontend calls detail/list endpoints for the chosen school IDs or slugs.
4. Compare-add action posts `COMPARE_ADD` to engagement API.
5. The popularity task later consumes deduplicated daily events.

Comparison data is client-side until a backend action is explicitly made.

## 7. Parent submits an admission enquiry

1. A visitor or parent opens the enquiry form from a profile or `/counselling/`.
2. For a parent, frontend identifies the school, child, and academic year.
3. `POST /api/admissions/enquiries/` validates the school and payload.
4. Guest submissions can create a lead without a parent account.
5. Parent submissions link `parent_profile` and optional `child`.
6. The school, guest data, status, priority, and current timestamp are stored.
7. The school/admin queue and parent application view can read the new row.

## 8. Enquiry received and managed

1. School/staff CRM receives it in Django Admin or a dashboard route.
2. Staff or school admin changes CRM status and optional assignee/follow-up time.
3. The API writes an application status event where application-status changes are used.
4. Parent notifications and email may be generated, according to notification logic.
5. The parent sees the status in `/dashboard/parent/applications/{enquiryId}/`.

## 9. School admin updates school details

1. Verified school admin logs in and opens `/dashboard/school/`.
2. Frontend loads `GET /api/dashboards/school/` and `/api/schools/schools/mine/`.
3. Profile fields are proposed through the portal/mine API.
4. `SchoolProfileChange` stores pending JSON or direct fields where staff approval is not required.
5. Facilities, grades, photos, resources, and fees use dedicated content-change routes.
6. Staff approves or rejects in Django Admin/profile queue.
7. Approved values update the public `School` or child record.

## 10. School admin manages enquiries

1. Dashboard loads enquiries for the own-school scope.
2. Admin opens an enquiry row.
3. `PATCH /api/dashboards/school/enquiries/{id}/status/` updates status.
4. `IsOwnEnquiryOrHigher` prevents cross-school access.
5. Parent receives an in-app notification or email only if the notification code successfully creates/delivers it.

## 11. Staff admin manages assigned tasks

1. Staff login opens `/dashboard/staff-admin/`.
2. Dashboard calls `/api/dashboards/staff-admin/`.
3. Staff sees global queues visible through the staff role.
4. Django Admin provides verification, profile/content queues, leads, reviews, blogs, guides, and master data.
5. Staff can process these without a single-school restriction.
6. Staff cannot access every model solely through Next.js; Django permissions still apply.

## 12. Admin manages users and roles

1. Existing platform staff opens `/admin/`.
2. `UserAdmin` creates or edits a user.
3. Admin sets role and active/email flags.
4. For school-admin accounts, an associated `SchoolAdminProfile` must reference a verified or pending school.
5. Staff/super and Django flags are independent; superuser status controls Django Admin, while role controls API permissions.

## 13. Admin adds a new school

1. Create/reuse country, state, city, and locality.
2. Create boards, types, grades, facilities, and academic year if missing.
3. Staff creates a `School` in Django Admin or through staff-authorised API.
4. Set unique code, SEO slug, geography, address, board/type links, and public status.
5. Set verification status.
6. Add media and published fees.
7. Optional promotion creates/updates the featured state.

## 14. Admin manages content and images

1. Staff edits school fields or URLs in Django Admin.
2. School photos/videos may be inlines or queued school content changes.
3. Approved content updates public URL fields and child rows.
4. Blog and guide images use their own upload services.
5. R2-backed school media is served or proxied by configured media routes.

## 15. Admin moderates reviews

1. Review is created with status `PENDING`.
2. Public review endpoint does not expose pending/rejected rows.
3. Staff opens `ReviewAdmin`.
4. Only a Super Admin sets `APPROVED` or `REJECTED`; the operation records moderator and time. Submitted content is immutable.
5. Verified published reviews contribute to popularity quality calculation.
6. The next hourly recalculation updates the school score. Only approved reviews are public; school admins can view only their own school's reviews and have no moderation actions.

## 16. Popularity and featured workflow

1. Public frontend sends only allowed engagement event types.
2. Backend validates public school status and throttles the request.
3. Identity hash, optional session hash, date bucket, and event type are stored.
4. Same identity is deduplicated once per event per UTC date.
5. Celery beat calls `refresh_school_popularity` hourly when a worker/beat is deployed.
6. The scorer applies configured weights and exponential decay.
7. Verified published reviews add a quality term.
8. Popular scores are stored and used to rank popular listings.
9. Featured promotions independently place or label selected schools.
