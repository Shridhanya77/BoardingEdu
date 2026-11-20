# 9. Backend technical documentation

## Project structure

```text
backend/
  config/           settings, urls, pagination, health, admin dashboard, school media
  apps/geography
  apps/schools
  apps/fees
  apps/users
  apps/admissions
  apps/reviews
  apps/search
  apps/notifications
  apps/dashboards
  apps/guides
  apps/blogs
  apps/subscriptions
  templates/admin
  requirements.txt
  Procfile
  .env.example
```

`manage.py` is the Django entry point. `ROOT_URLCONF` is `config.urls`. Installed apps are listed in `config/settings.py`.

## App responsibilities

Each app is summarised in [System architecture](02_SYSTEM_ARCHITECTURE.md). The notes below are the behaviour that is easy to miss.

### Schools

`SchoolViewSet` is the directory. Public list and retrieve hide schools with `status=False` unless the caller is a platform admin. Custom actions:

| Action | Method | Path | Permission |
| --- | --- | --- | --- |
| List and retrieve | GET | `/api/schools/schools/` and `/{id}/` | Public for active schools |
| By slug | GET | `/api/schools/schools/by-slug/{slug}/` | Public, active schools |
| Popular | GET | `/api/schools/schools/popular/` | Public |
| Mine | GET, PATCH | `/api/schools/schools/mine/` | Authenticated school admin |
| Register | POST | `/api/schools/schools/register/` | Public, registration throttle |
| Verification queue | GET | `/api/schools/schools/verification-queue/` | Staff admin |
| Verification history | GET | `/api/schools/schools/{id}/verification-history/` | Staff admin |
| Set verification | POST | `/api/schools/schools/{id}/verification/` | Staff admin |
| Create, update, delete | POST, PUT, PATCH, DELETE | `/api/schools/schools/` | Platform admin |

`Board`, `Grade`, and `Facility` viewsets are public reads and platform-admin writes. `SchoolType` is public read only. `SchoolFAQ` is a read-only viewset.

Engagement ingestion is `POST /api/schools/engagement/` (`SchoolEngagementView`). It accepts only `SCHOOL_VIEW`, `LISTING_CLICK`, and `COMPARE_ADD`.

### Fees

Viewsets: academic years, fee terms, fee structures, fee items. Writes require a platform admin. `PublicFeeEstimateView` powers the fee calculator and does not require a login. School-admin fee edits go through dashboard routes, not through a direct publish on the public viewset.

### Users

`UserViewSet.register` creates parents. Profile viewsets exist for parent, school admin, and staff admin profiles. Password endpoints are separate from the router (`password_api.py`).

### Admissions

`ChildViewSet` and `AdmissionEnquiryViewSet` are model viewsets with object-level ownership. `CounsellingRequestCreateView` is create-only. Parent application, document, message, notification, and profile routes are in `admissions/parent_api.py` and mounted in `admissions/urls.py`.

### Reviews

`ReviewViewSet` filters published reviews for anonymous reads. Creates require a parent. One review per user per school. Default status is `PENDING`.

### Search

`SuggestionView` is unauthenticated and has empty `authentication_classes`, so a bad token cannot block suggestions. Meilisearch is used when configured. Signals in `search/signals.py` push school changes. `manage.py rebuild_school_search_index` rebuilds the index.

### Notifications

OTP issue and verify, email change OTP, Resend webhook signature check, preference get/update, and unsubscribe by token. `services.py` sends school-admin and parent mail through the configured provider. `sms.py` sends only when both SMS variables are set. Saved-search matching is `notifications/matching.py`.

### Dashboards

Aggregation views plus `school_ops.py` for approved-later writes. See the school admin document.

### Subscriptions

Plan list, current subscription, Razorpay order, signature verify, and webhook.

## Serializers and validation

Serializers live next to each app (`serializers.py`). Important ones:

| Serializer | Behaviour |
| --- | --- |
| `SchoolListSerializer` / `SchoolDetailSerializer` | Public card and profile payloads, including annotated rating and fee |
| `SchoolPortalSerializer` | Fields a school admin may propose |
| `SchoolRegistrationSerializer` | Creates a pending, unpublished school and its admin |
| `EmailOrUsernameTokenObtainPairSerializer` | Login, school-admin gate, OTP challenge |
| Enquiry and counselling serializers | Guest versus parent payloads, required school and academic year |
| Review serializer | Rating bounds and ownership |
| Blog serializers | Published posts only on public views |

Model `clean()` and constraints add a second layer: promotion date order, guide section shape, blog publish requirements, unique shortlist, unique review per user and school, unique fee structure per school and year.

## Permissions

Defined in `apps/users/permissions.py` and a few local classes (`IsReviewOwnerOrHigher`). Full matrix: [Authentication and permissions](13_AUTHENTICATION_AND_PERMISSIONS.md).

Default DRF permission `DjangoModelPermissionsOrAnonReadOnly` still applies where a view does not override `permission_classes` or `get_permissions`. Catalogue viewsets override it.

## Admin panel architecture

Jazzmin wraps Django Admin. `install_admin_dashboard()` customises the index. School change review, verification, and promotion forms live in `apps/schools/admin.py`. School admins who are given Django staff access are scoped by `AssignedSchoolAdminMixin` and `CatalogVisibleToSchoolAdminMixin`. The product’s intended school UI is the Next.js console, not Django Admin.

## Files and images

| Asset | Storage |
| --- | --- |
| School logo, cover, gallery, video URLs | URL fields. Public files are proxied from R2 by `config.school_media` |
| Blog cover, category image, inline image | `ImageField`, optimized by `store_optimized_image` |
| Parent photo | Private storage, `parent-profiles/` |
| Application document | Private storage, path `{enquiry_id}/{uuid}.ext` |
| Featured banner | URL field on `FeaturedPromotion` |

The media routes do not accept uploads. They stream an existing object key.

## Search and filtering

Directory search is SQL `SearchFilter` on the school viewset. Autocomplete is Meilisearch plus SQL. Filters are `SchoolFilter` (django-filter). Geography filters require a consistent country/state/city/locality chain. Fee filters annotate `annual_fee` and compare with `gte` or `lte`.

## Pagination and sorting

Cursor pagination is the global default. School lists use offset pagination and `NullsLastOrderingFilter`. A tie is broken by `school_name` and `school_id`. Featured filtering orders by promotion priority first.

## Background tasks

| Task | Module | When |
| --- | --- | --- |
| `refresh_school_popularity` | `apps.schools.tasks` | Beat, hourly |
| `deliver_saved_search_alerts` | `apps.notifications.tasks` | Beat, every 6 hours |
| Meilisearch upsert/delete | `apps.search.signals` | On model save, inline |

`CELERY_TASK_ALWAYS_EAGER` is true when `REDIS_URL` is empty, so tasks run inside the web process in local development without Redis. With Redis, a worker must be running. The Render blueprint does not start one.

Management commands:

- `rebuild_school_search_index`
- `send_saved_search_alerts`
- `import_scraped_schools`
- `manage_school_photos`
- `normalize_academic_years`

## Notifications and email

Providers: `EMAIL_PROVIDER` of `brevo`, `resend`, or Cloudflare. OTP can use `OTP_EMAIL_PROVIDER=auto`. Templates: `notifications/templates/emails/notification.html` and `.txt`.

`EmailDelivery` records recipient, subject, type, and status (`PENDING`, `ACCEPTED`, `DELIVERED`, `FAILED`, `BOUNCED`). The Resend webhook updates that row when `RESEND_WEBHOOK_SECRET` validates the signature.

In-app `ParentNotification` rows are separate from email. Preferences default to opted in until a row says otherwise. Transactional mail is not blocked merely because a preference row is missing. Unsubscribe sets `unsubscribed_at`.

## Errors and logging

API errors use DRF’s exception handler and explicit `Response` with `detail`. OTP failures return 429 for cooldown or rate limit and 503 when mail cannot be sent. School registration is rolled back if the OTP email fails.

Logging is stdout. `django.request` and `django.security` log warnings. Sentry is optional.

## Security controls in code

- JWT HS256 signed with `SECRET_KEY`, 15-minute access, 7-day rotating refresh, blacklist
- OTP for parent and school-admin login and registration, with expiry, resend cooldown, and max attempts
- School-admin token refresh re-checks verification
- Scoped throttles for counselling, reviews, enquiries, registration email, blog subscribe, and engagement
- Suspicious engagement flag after 30 events per identity per hour. The flag is stored. The scorer does not exclude `suspicious=True` rows
- CORS and CSRF origins from the environment
- Security middleware, referrer policy, COOP, and `X-Frame-Options: SAMEORIGIN`
- Blog HTML sanitization
- Private storage for application files
- Razorpay signature verification before a subscription becomes active
- Resend webhook signature verification
- Visitor engagement cookie is `httponly`, `SameSite=Lax`, and `Secure` when `DEBUG` is false. The database stores a salted HMAC of the visitor or user id, not the raw id

## Migrations

Django migrations under each app’s `migrations/` folder are the schema history. School engagement and popularity were added in `schools/0022` through `0026`. Counselling preferred states are `admissions/0006`. Apply with `manage.py migrate` during deploy (`build.sh` / `start.sh`). Do not edit applied migrations to change production data.

## Deployment configuration

Covered in [Deployment](15_DEPLOYMENT_AND_CONFIGURATION.md). Settings read environment variables and do not hard-code production secrets. `DATABASE_URL` overrides the legacy `DB_*` keys. Hosts ending in `.render.com` enable SSL. Railway internal Redis hostnames are ignored unless `RAILWAY_ENVIRONMENT` is set, so a copied Railway URL cannot hang DNS on Render.
