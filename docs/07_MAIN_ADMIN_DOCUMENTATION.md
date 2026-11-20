# 7. Main admin and super admin

Super Admin is `User.role = SUPER_ADMIN`. In the API, `IsSuperAdmin` is the strictest role check, and `IsStaffAdmin` also returns true for super admins. Django superuser (`is_superuser`) is a separate flag used by `IsPlatformAdmin` and by Django Admin. A production owner is typically both `SUPER_ADMIN` and a Django superuser. Those two flags are not the same field.

## Where super admins work

| Surface | Path | Role |
| --- | --- | --- |
| Platform dashboard | `/dashboard/admin/` | `STAFF_ADMIN` and `SUPER_ADMIN` |
| Staff queues | `/dashboard/staff-admin/` | Same |
| Django Admin | `/admin/` | Django staff users with model permissions. Superuser sees everything |
| OpenAPI | `/api/schema/swagger-ui/` and `/api/schema/redoc/` | Public in current settings (`SERVE_PERMISSIONS = AllowAny`) |

Jazzmin (`JAZZMIN_SETTINGS` in `config/settings.py`) themes Django Admin: BoardingEdu branding, sidebar groups, and a school search box. The admin index is customised by `config.admin_dashboard.install_admin_dashboard` and `backend/templates/admin/index.html`.

There is no Next.js screen for creating users, boards, or cities. That work is Django Admin or the API.

## Platform dashboard

`GET /api/dashboards/admin/` returns:

- School totals, publicly listed (`status=True`), pending verification, verified, added this month
- User counts by role and new users this month
- Enquiry total, this month, and counts by CRM status
- Review counts by status
- Counselling total and new count
- Cities covered by listed schools
- Counts by school type name
- Data-quality counts: missing logo, cover, about, both phone and email, locality, board, published fees, and unverified
- Eight recently updated schools, ten pending schools, ten recent enquiries

`frontend/app/dashboard/admin/page.tsx` renders those figures and can verify or reject a pending school through `setSchoolVerification`, which posts to `/api/schools/schools/{id}/verification/`.

## Django Admin map

| Admin class | Model | Purpose |
| --- | --- | --- |
| `UserAdmin` | `User` | Accounts, role, active flag, email verified |
| `ParentProfileAdmin` | `ParentProfile` | Parent address and contact preference |
| `SchoolAdminProfileAdmin` | `SchoolAdminProfile` | Bind a user to one school |
| `StaffAdminProfileAdmin` | `StaffAdminProfile` | Designation and department |
| `CountryAdmin`, `StateAdmin`, `CityAdmin`, `LocationAdmin` | Geography | Four-level place tree. School admins can see catalogues but not own them (`CatalogVisibleToSchoolAdminMixin`) |
| `BoardAdmin`, `GradeAdmin`, `FacilityAdmin` | Catalogues | Shared school attributes |
| `SchoolTypeAdmin` | `SchoolType` | Day, day boarding, boarding. API cannot create these |
| `SchoolFAQAdmin` | `SchoolFAQ` | Directory FAQs, optional place/board/type scope. `status` defaults to false, so a new FAQ is hidden until enabled |
| `SchoolAdmin` | `School` | Full school record, inlines, verification, profile gaps |
| Inlines on school | Facilities, grades, photos, videos | Direct staff edit, plus approval mixin for school-admin submissions |
| `SchoolVerificationEventAdmin` | `SchoolVerificationEvent` | History of verification changes |
| Profile and content change admins | `SchoolProfileChange`, `SchoolContentChange` | Approve, reject, or leave pending |
| `FeaturedPromotionAdmin` | `FeaturedPromotion` | Featured or sponsored placement, priority, dates |
| `SchoolEngagementAdmin` | `SchoolEngagement` | Raw events. Hashes, not raw visitor ids |
| `SchoolPopularityAdmin` | `SchoolPopularity` | Calculated scores |
| `SchoolEngagementWeightAdmin`, `SchoolPopularityConfigAdmin` | Weights and config | Scoring settings |
| `AcademicYearAdmin`, `FeeTermAdmin`, `FeeStructureAdmin`, `FeeItemAdmin` | Fees | Master data and per-school fees |
| `ChildAdmin`, `AdmissionEnquiryAdmin` | Admissions | Children and the CRM pipeline |
| `CounsellingRequestAdmin` | `CounsellingRequest` | Counselling queue |
| `ApplicationStatusEventAdmin`, `ApplicationDocumentAdmin`, `ApplicationMessageAdmin` | Application trail | Timeline, files, messages |
| `ReviewAdmin` | `Review` | Moderation |
| `GuideCategoryAdmin`, `GuideArticleAdmin` | Guides | Public guides |
| `BlogCategoryAdmin`, `BlogPostAdmin`, `BlogImageAdmin`, `BlogSubscriberAdmin` | Blogs | Editorial workflow |
| `EmailDeliveryAdmin`, `ParentNotificationAdmin` | Notifications | Delivery log and in-app notices |
| `SubscriptionPlanAdmin`, `SchoolSubscriptionAdmin`, `SubscriptionPaymentAdmin` | Subscriptions | Prices and payments |

`AssignedSchoolAdminMixin` limits a school-admin Django user to their own school’s rows when they are allowed into admin. Platform staff are not limited to one school.

## User management

`UserAdmin` is the place to:

- Create a parent, school admin, staff admin, or super admin
- Set `is_active`, `is_staff`, and `is_superuser`
- Mark email verified when support must unblock an account
- Assign Django permissions for admin modules

Creating a school admin in the API without a `SchoolAdminProfile` does not make a working school login. The profile row must point at a school.

Parents can self-register. Schools can self-register into `PENDING`. Staff and super admins are created by an existing administrator. There is no public staff signup page.

## School management

Adding a school as staff:

1. Create or reuse country, state, city, and optional locality.
2. Create the school in Django Admin or `POST /api/schools/schools/` as a platform admin.
3. Set `school_code`, name, address, geography, boards, and school types.
4. Set `status=True` only when the profile should be public.
5. Set `verification_status=VERIFIED` when the school admin may log in.
6. Add grades, facilities, photos, and a fee structure.
7. Optionally add a `FeaturedPromotion`.

`School.save()` rewrites empty or UUID-like slugs into a unique SEO slug.

`ProfileGapFilter` on the school changelist highlights incomplete profiles. The same gaps feed the admin dashboard data-quality block.

Verification writes `SchoolVerificationEvent` (previous status, new status, note, actor). The note is required by the verification service used by the API.

## Geography, boards, and school types

Places are a strict chain: country → state → city → locality. Codes and slugs are unique inside the parent (for example one city slug per state). Schools store all four foreign keys, and list filters reject combinations that break the chain.

Boards have `board_code`, name, and slug. Schools link many boards.

School types are the canonical day, day-boarding, and boarding records. Home page categories are derived from the type code, slug, and name. They are not a separate table.

## Academic years and fees

`AcademicYear.is_current` marks the year used for public fee comparisons. Fee terms are unique per year and term code. One fee structure per school per year is enforced (`uq_fee_structure_school_academic_year`).

Staff can publish a structure immediately in Django Admin. A school admin can only queue publication.

## Media

Staff paste logo, cover, photo, and video URLs, or rely on the R2 proxy path `/media/schools/<file>`. Blog covers and inline images are uploaded through Django image fields and optimized before save. Application documents stay on private storage and are not managed as marketing media.

## Reviews

`ReviewAdmin` is the moderation screen. Review content is read-only. Only a Super Admin can approve or reject pending reviews; each action records `moderated_by` and `moderated_at`. Status `PENDING` is hidden on the website. `APPROVED` is public. `REJECTED` is kept and hidden. `is_verified` is read-only from this screen and influences the popularity quality score only when true.

## Enquiries and leads

`AdmissionEnquiryAdmin` is the full CRM: status, priority, assignee, follow-up time, guest fields, and application status. School admins who reach this admin see only their school (`AssignedSchoolAdminMixin`).

Counselling requests are a separate queue with statuses `NEW`, `CONTACTED`, `CLOSED`.

## Content, SEO, and featured schools

- Guides: staff edit title, summary, cover URL, category, sections JSON, and `status`.
- Blogs: draft, published, archived. SEO fields are `meta_title`, `meta_description`, `canonical_url`. Featured blog posts are a boolean, unrelated to featured schools.
- School FAQs can be global or tied to a place, board, or school type.
- Featured schools: `FeaturedPromotionAdmin` sets label `FEATURED` or `SPONSORED`, priority, heading, banner, description, highlight lines, active flag, and optional start and end dates. Saving syncs `School.is_featured`. Deleting the promotion clears the flag. There is no self-serve promotion purchase for schools.

There is no separate SEO database for listing pages. Listing titles are generated in `frontend/lib/seo.ts`.

## Popularity configuration

Staff with access to the popularity admins can change event weights, enable or disable an event type, and edit the single `SchoolPopularityConfig` row (`config_id = 1`): rolling window days, half-life days, quality weight, and review saturation count. The hourly task recalculates scores. The admin screen shows the last calculation. It does not recalculate on every page view.

## Reports and analytics

Live counts on the two Next.js dashboards and the Django admin index are the analytics. Engagement rows can be inspected but are not a product analytics suite. No warehouse export is implemented.

## Audit and security

Implemented history:

- `SchoolVerificationEvent`
- `SchoolProfileChange` and `SchoolContentChange` with submitter, reviewer, time, and note
- `ApplicationStatusEvent`
- `EmailDelivery` status
- JWT refresh blacklist
- Django admin’s built-in `LogEntry` for admin saves

Not implemented: a product-wide audit log of parent reads, a SIEM export, or an admin activity report in the Next.js UI.

## System configuration

Environment and secrets are not edited in the application. They are set on Render and in local `.env` (see the deployment document). Django Admin does not expose a settings editor.
