# 6. Staff admin

Staff Admin is `User.role = STAFF_ADMIN` with an optional `StaffAdminProfile` (`designation`, `department`). The profile does not store a school. Staff are platform operators, not employees of one school.

This role is not a copy of Super Admin, and it is not a copy of School Admin.

## Login

`POST /api/auth/jwt/token/` returns access and refresh tokens directly. Staff are not in `OTP_ROLES`, so login does not send an email code. Refresh, verify, and blacklist work the same as for other roles.

Django Admin is a second login, using Django’s session form at `/admin/login/`. A staff user can use Django Admin only when `is_staff` is true and the model permissions allow the screen. Creating a `STAFF_ADMIN` row does not by itself grant every Django permission. Those permissions are assigned on the user in Django Admin.

The Next.js pages only check the role:

- `/dashboard/staff-admin/` allows `STAFF_ADMIN` and `SUPER_ADMIN`
- `/dashboard/admin/` allows the same two roles

## Staff dashboard

`frontend/app/dashboard/staff-admin/page.tsx` calls `GET /api/dashboards/staff-admin/` (`StaffAdminDashboardView`, permission `IsStaffAdmin`).

Queues:

| Figure | Source |
| --- | --- |
| Reviews pending | `Review.status = PENDING` |
| Schools pending | `School.verification_status = PENDING` |
| New enquiries | `AdmissionEnquiry.status = NEW` |
| Unassigned enquiries | Enquiries with no `assigned_to` |
| Counselling requests | `CounsellingRequest.status = NEW` |

The page also shows this month’s enquiry, review, and counselling counts, and tables of the latest pending reviews, pending schools, and open enquiries. It is a queue viewer. Buttons on that page do not edit the records. Acting on them is done in Django Admin or, for school verification, on the platform admin dashboard.

## Platform dashboard access

`IsStaffAdmin` allows both staff and super admins, so staff can open `GET /api/dashboards/admin/` and can call `POST /api/schools/schools/{id}/verification/`. The platform page (`frontend/app/dashboard/admin/page.tsx`) lets them mark a pending school verified or unverified. That is intentional in the current permission class, not an accident of the UI.

## What staff can do

| Area | Access in the current code |
| --- | --- |
| Read all schools, including unpublished | Yes. `SchoolViewSet.get_queryset` skips the public filter for staff and super admins |
| Verification queue and history | Yes. `GET /api/schools/schools/verification-queue/` and `GET /api/schools/schools/{id}/verification-history/` |
| Set verification | Yes, with a note. A status change emails school admins who have an email address |
| Read and update enquiries | Yes. `IsOwnEnquiryOrHigher` lets staff pass object checks. They can set `assigned_to` because that field is limited to staff users |
| Read children linked to enquiries, and all children where the view allows higher roles | Yes |
| Read all parent profiles | Object permission `IsOwnParentProfile` returns true for staff |
| Moderate reviews | Django Admin `ReviewAdmin`. API writes follow the review viewset, which allows higher roles |
| Counselling requests | Django Admin. There is no staff counselling screen in Next.js |
| Blogs and guides | Django Admin, if the user has those model permissions (`BlogAdminMixin` checks staff capability) |
| Featured promotions | Django Admin if `_is_platform_promotion_admin` passes |
| School profile and content approval | Django Admin if `is_school_change_reviewer` passes |
| Catalogue writes (boards, facilities, grades, places, fees master) | API `IsPlatformAdmin` includes staff. Django Admin still needs model permissions |
| School type creation | Not through the API. `SchoolTypeViewSet` is read-only. Create types in Django Admin if the model admin allows it |
| User and role administration | Not granted by the staff dashboard. `UserViewSet` permissions must be checked per action. Staff must not be treated as able to create super admins |
| System settings, JWT keys, environment | No application screen. Those are hosting configuration |
| Another school’s subscription payment records | Visible in Django Admin to users with those permissions. The school console only shows the signed-in school |

`IsPlatformAdmin` is true for staff, super admins, and Django superusers. It is the write gate on geography, boards, grades, facilities, and fee master viewsets.

## What staff cannot do

- Sign in as a school and edit that school through `/api/schools/schools/mine/`. That action checks `role == SCHOOL_ADMIN`.
- Use the parent dashboard’s shortlist as their own family account unless they also have a parent profile, which a staff user does not get automatically.
- Bypass a missing Django permission inside `/admin/` merely because their role string is `STAFF_ADMIN`.
- Change popularity formula code. They can change weights and the rolling window in Django Admin if they have access to `SchoolEngagementWeight` and `SchoolPopularityConfig`.
- See secrets. Django Admin does not display environment secrets.

## Assigned responsibilities

The only first-class assignment is `AdmissionEnquiry.assigned_to`, limited to users with role `STAFF_ADMIN`. There is no task, ticket, or territory model. Department on `StaffAdminProfile` is descriptive text. It does not filter enquiries.

Staff workload on the dashboard is global, not “my assigned queue only”. A staff user sees every new and unassigned enquiry, not a personal subset.

## Content management

Staff do not have a Next.js CMS. Content is managed in Django Admin:

- Schools and inline facilities, grades, photos, videos
- Pending `SchoolProfileChange` and `SchoolContentChange` reviews
- `FeaturedPromotion`
- `GuideArticle` and `GuideCategory`
- `BlogPost`, `BlogCategory`, `BlogImage`, `BlogSubscriber`
- `SchoolFAQ`
- Reviews

Blog HTML is sanitized in `apps.blogs.html.sanitize_blog_html` before save. Published posts require a short description, content, cover image, and author name.

## Reports

The staff page and the platform admin page are the reports. There is no CSV export endpoint and no scheduled PDF. Figures are counted live from PostgreSQL when the dashboard API is called.

## Practical boundary versus Super Admin

Use Staff Admin for operations: verification, enquiry handling, review moderation, counselling follow-up, and content edits they have been permitted to make in Django Admin.

Reserve Super Admin for creating staff users, granting Django permissions, and any action that should not be shared with every operator. The API’s `IsStaffAdmin` currently lets staff call the same dashboard and verification endpoints as super admins. That overlap is documented again in the permissions paper.
