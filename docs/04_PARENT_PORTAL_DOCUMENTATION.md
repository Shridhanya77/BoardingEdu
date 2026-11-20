# 4. Parent portal

Parents use role `PARENT`. Registration creates `users.User` and a `ParentProfile`. The dashboard shell is `frontend/components/parent-dashboard/ParentDashboard.tsx`, mounted from:

- `/dashboard/parent/`
- `/dashboard/parent/{section}/`
- `/dashboard/parent/applications/{enquiryId}/`
- `/dashboard/parent/compare/`

Section ids: dashboard, applications, students, finder, shortlist, saved-searches, recent, documents, notifications, messages, profile, settings.

## Registration and login

1. Open `/signup/`.
2. The client calls the parent registration action on `UserViewSet` (`POST /api/users/users/register/`).
3. The user is created with `role=PARENT`. A `ParentProfile` is created with the user.
4. An email OTP is issued (`purpose=register`). Tokens are not returned yet.
5. `/verify-otp/` calls `POST /api/auth/otp/verify/`.
6. On success the client stores access and refresh tokens.

Login (`POST /api/auth/jwt/token/`) accepts email or username (`EmailOrUsernameTokenObtainPairSerializer`). For parents it sends an OTP and returns `otp_required` instead of tokens. Access tokens last 15 minutes. Refresh tokens last 7 days, rotate, and the previous refresh is blacklisted.

Logout calls `POST /api/auth/jwt/blacklist/` with the refresh token and clears client storage.

Password reset: `POST /api/users/password-reset/` then `POST /api/users/password-reset/confirm/`. Change while signed in: `POST /api/users/password-change/`.

Email change uses `POST /api/auth/otp/email/` and `POST /api/auth/otp/email/verify/`.

## What the parent can manage

| Area | View | Add | Edit | Delete |
| --- | --- | --- | --- | --- |
| Own profile | Yes | Created at signup | Address, occupation, contact method, photo | No self-delete in the dashboard |
| Children | Own children only | Name, date of birth, gender, current grade | Those fields | Yes, own child if no protected dependency blocks it |
| Shortlist | Own rows | School and optional note | Note | Remove a school |
| Saved searches | Own rows | Filters and alert frequency | Name, filters, frequency, active flag | Yes |
| Recently viewed | Own rows | Recorded when a profile is opened | Timestamp refreshed on repeat views | One row or clear all |
| Enquiries / applications | Own, or guest rows the API scopes to the parent | From a school profile or finder | Message at create time; later documents and messages | Withdraw sets application status `WITHDRAWN`. The row is kept |
| Reviews | Own review per school | Rating 1–5, optional category ratings, title, body | While permitted by the review viewset | Owner or staff |
| Notifications | Own in-app notices | Created by the server | Mark read | No delete control in the UI |
| Other parents, schools’ private data, staff tools | No | No | No | No |

## Dashboard overview

`GET /api/dashboards/parent/` (`ParentDashboardView`).

The overview shows journey steps (`ParentJourney`): add a child, shortlist or open the finder, save a search, and submit an application. Stat cards use enquiry, shortlist, and unread notification counts returned by that endpoint. The exact card set is rendered in `ParentDashboard.tsx` after the payload loads.

## Children

UI section `students`. API: `ChildViewSet` at `/api/admissions/children/`.

Fields: `name`, `date_of_birth`, `gender` (`MALE`, `FEMALE`, `OTHER`), optional `current_grade`. `IsOwnChildOrHigher` limits parents to `parent_profile.user`. School admins can read a child only when that child has an enquiry at their school. Staff and super admins can read all children.

## Find schools

Section `finder` renders `ParentSchoolFinder`, which reuses the public directory filters. From a result the parent can open the profile, shortlist, compare, or enquire. Searching does not require a special parent-only school API. The same public school list is used.

## Shortlist

`GET/POST /api/dashboards/parent/shortlist/` and delete on the same resource.

`ParentShortlist` is unique per parent and school (`uq_parent_shortlist_school`). A note of up to 240 characters is allowed. Adding a school records `SHORTLIST_ADD` in `record_school_engagement` (`dashboards/views.py`). The parent compare page at `/dashboard/parent/compare/` compares shortlisted schools.

## Saved searches

`SavedSearches.tsx` and:

- `GET/POST /api/dashboards/parent/saved-searches/`
- `GET/PATCH/DELETE /api/dashboards/parent/saved-searches/{id}/`

A saved search stores country, state, city, locality, home category, school types, boards, facilities, gender, minimum and maximum fee, keywords, and `alert_frequency`: `INSTANT`, `DAILY`, `WEEKLY` (default), or `OFF`.

Matching uses the same school queryset and annual-fee annotation as the public directory. `SavedSearchMatch` prevents emailing the same school twice for the same search. Delivery is the Celery task `deliver_saved_search_alerts`, or the management command `send_saved_search_alerts`. Alerts are skipped when the parent has turned off `saved_search_alerts` or has unsubscribed.

## Applications

List: `GET /api/admissions/applications/`.
Detail page: `/dashboard/parent/applications/{enquiryId}/` via `GET /api/admissions/applications/{enquiry_id}/`.

The parent sees school, child, academic year, grade, CRM status, application status, timeline (`ApplicationStatusEvent`), documents, and messages.

Application statuses: `SUBMITTED`, `RECEIVED`, `UNDER_REVIEW`, `DOCUMENTS_REQUIRED`, `INTERACTION_SCHEDULED`, `INTERACTION_COMPLETED`, `OFFERED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`.

CRM statuses, visible as the school’s pipeline, are `NEW`, `ASSIGNED`, `IN_PROGRESS`, `CALL_BACK`, `CONVERTED`, `CLOSED_LOST`, `SPAM`.

Withdraw: `POST /api/admissions/applications/{enquiry_id}/withdraw/`.

## Documents

Upload: `POST /api/admissions/applications/{enquiry_id}/documents/`.
Download: `GET .../documents/{document_id}/file/`.

Types: birth certificate, report card, transfer certificate, photograph, identity, other. Files go to private storage, not the public R2 school prefix. Review status is `PENDING`, `VERIFIED`, or `REJECTED`. Parents upload. School or staff reviewers set the review status at `.../documents/{document_id}/review/`.

The Documents section of the dashboard summarises documents across the parent’s applications. It is not a separate document library.

## Messages

`GET/POST /api/admissions/applications/{enquiry_id}/messages/` stores `ApplicationMessage` rows (author, body, time). The Messages section lists conversations that already exist on applications. There is no general parent-to-platform inbox outside an enquiry.

## Notifications

In-app: `ParentNotification` via `GET /api/admissions/notifications/` and read endpoints under `/api/admissions/notifications/read/`.

Email preferences: `GET/PATCH /api/notifications/preferences/` for saved-search alerts and admission-opening alerts. Unsubscribe: `POST /api/notifications/unsubscribe/{token}/` and the page `/unsubscribe/{token}/`.

When a shortlisted school opens admissions, `ShortlistAdmissionNotice` stops the same parent being notified twice for that school.

## Reviews

`ReviewViewSet` at `/api/reviews/`. A parent may submit one review per school (`uq_review_school_user`). New reviews are always `PENDING`. Parents can read their own moderation status but cannot edit or delete submitted reviews. Only a Super Admin can approve or reject a pending review; approval sets `APPROVED` and rejection sets `REJECTED`. Both decisions record moderator and timestamp. Optional sub-ratings: academics, facilities, safety, communication.

Only `APPROVED` reviews appear publicly. Pending and rejected reviews are hidden from anonymous users.

## Profile and settings

Profile: `GET/PATCH /api/admissions/profile/` and photo `POST/DELETE /api/admissions/profile/photo/`. Photo storage is private.

Settings holds password change. Notification preference controls live with the notification API rather than a second settings model.

## Logout

The dashboard shell clears tokens and blacklists the refresh token, then returns the user to the public site. A blacklisted refresh token cannot mint a new access token.
