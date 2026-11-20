# 1. Project overview

## What BoardingEdu is

BoardingEdu helps families find day schools, day-boarding schools, and residential schools, then start an admission conversation with a school. Schools publish a public profile. Platform staff verify schools, moderate reviews, and maintain shared catalogues such as boards, grades, facilities, and geography.

The product is not a full school ERP. It does not run attendance, payroll, timetables, or student information systems. Staff and faculty are not stored as their own records. The school profile has a principal name, and campus features are stored as facilities, photographs, videos, grades, and fee lines.

## Technology in this repository

| Layer | Implementation found in code |
| --- | --- |
| Frontend | Next.js 14 (`^14.2.35`), React 18, TypeScript, Tailwind CSS, App Router |
| Backend | Django 5.2.18, Django REST Framework 3.18.1 |
| Auth | SimpleJWT 5.5.1, refresh rotation and blacklist, email OTP for parents and school admins |
| Database | PostgreSQL via `DATABASE_URL` (psycopg 3). Render blueprint uses PostgreSQL 16 |
| Cache and jobs | Redis when `REDIS_URL` is set; otherwise local memory cache and eager Celery |
| Search | Meilisearch for school suggestions, with a database fallback |
| Media | Cloudflare R2 for school images, served through `/media/schools/` |
| Email | Brevo, Resend, or Cloudflare Email Service, selected by environment |
| Payments | Razorpay for school lead-access subscriptions |
| Admin UI | Jazzmin theme over Django Admin |
| Frontend hosting | Vercel (`vercel.json`) |
| API hosting | Render web service (`render.yaml`), health check `/healthz` |
| API docs | OpenAPI via drf-spectacular at `/api/schema/`, Swagger, and ReDoc |

## Roles

The custom user model is `apps.users.models.User` (`db_table = users`). `AUTH_USER_MODEL` is `users.User`.

| Role code | Who | Primary surfaces |
| --- | --- | --- |
| Unauthenticated visitor | Anyone on the public site | Home, SEO listings, school profiles, compare, blogs, guides, counselling |
| `PARENT` | A family account | `/dashboard/parent/`, children, shortlist, applications |
| `SCHOOL_ADMIN` | One login tied to one school | `/dashboard/school/` after the school is `VERIFIED` |
| `STAFF_ADMIN` | Platform operations | `/dashboard/staff-admin/`, `/dashboard/admin/`, and Django Admin |
| `SUPER_ADMIN` | Platform owner | Same dashboards as staff, plus unrestricted Django Admin |

There is no separate anonymous “user” table. A guest can submit an admission enquiry or a counselling request without an account. Those records store guest contact fields.

## Major product areas

1. **Public discovery.** SEO URLs under `frontend/app/[...segments]/page.tsx` resolve country, state, city, locality, school type, board, and school profile paths.
2. **School profiles.** Overview, fees, admissions, facilities, infrastructure, photos and videos, reviews, location, and FAQ. Section ids live in `frontend/lib/school-sections.ts`.
3. **Comparison and shortlist.** Public compare at `/compare/`. Shortlist is stored per parent in `parent_shortlists`.
4. **Admissions.** `AdmissionEnquiry` is both a CRM lead and a parent application, with status events, documents, and messages.
5. **Counselling.** `CounsellingRequest` is a separate lead, not tied to one school unless `preferred_school` is set.
6. **Content.** Guides (`guide_articles`) and blogs (`blog_posts`) are staff-managed and publicly readable.
7. **School operations.** A school admin edits profile, grades, facilities, fees, photos, and admission resources. Changes are queued as `SchoolProfileChange` or `SchoolContentChange` until a reviewer approves them.
8. **Monetisation.** `SubscriptionPlan` controls whether a school can see parent contact details on leads.
9. **Ranking.** `SchoolEngagement` events feed `SchoolPopularity`. Featured placement is `FeaturedPromotion`, which also sets `School.is_featured`.

## Listing versus verification

Two flags are independent:

- `School.status` controls public listing. `public_school_queryset()` in `backend/apps/schools/querysets.py` returns schools with `status=True`.
- `School.verification_status` is `UNVERIFIED`, `PENDING`, or `VERIFIED`. A school admin can obtain a JWT only when the assigned school is `VERIFIED` (`school_admin_is_approved`).

Self-registration (`POST /api/schools/schools/register/`) creates the school with `status=False` and `verification_status=PENDING`, so it is not on the public directory until staff publish and verify it.

## Where day-to-day work happens

| Work | Where it is done |
| --- | --- |
| Browse schools | Next.js public pages |
| Parent tasks | Next.js parent dashboard |
| School profile and leads | Next.js school console, writes that need approval |
| Verify schools, moderate reviews, edit master data, blogs, guides, promotions | Django Admin at `/admin/` |
| Platform totals and approve/reject pending schools | Next.js `/dashboard/admin/` |
| Moderation queues | Next.js `/dashboard/staff-admin/` |

Django Admin is the real content-management system. The Next.js admin and staff pages are operational dashboards, not full replacements for Django Admin.
