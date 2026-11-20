# 16. Testing and implementation status

## Status scale

- **Implemented and verified in code**: source, tests, or route behavior confirms the feature.
- **Implemented but requires testing**: source exists but production or cross-layer behavior needs verification.
- **Partially implemented**: UI, API, or model exists but the workflow is incomplete.
- **Not implemented**: no verified implementation.
- **Cannot verify**: live third-party or runtime configuration is unavailable.

## Verified test coverage

Backend test modules exist for users, geography, reviews, admissions, dashboards, blogs, guides, fees, notifications/OTP, schools, search, and subscriptions. Frontend Vitest tests cover SEO slugs and blog dates. A Playwright E2E test covers canonical redirects.

This documents test presence, not successful execution in every environment.

## Feature status

| Feature | Status | Evidence and caveats |
| --- | --- | --- |
| Public school directory | Implemented and verified in code | School viewset, filters, public slugs, frontend catch-all routes |
| Search suggestions | Implemented but requires testing | Meilisearch optional; SQL fallback |
| Location/board/category browsing | Implemented and verified in code | Geography and school filters |
| School detail/fees/photos/facilities | Implemented and verified in code | Multiple serializers and routes |
| Comparison | Implemented but requires testing | Frontend compare page and engagement call need end-to-end verification |
| Shortlist | Implemented and verified in code | Parent dashboard and model constraints |
| Saved searches | Implemented and verified in code | User models and dashboard routes |
| Admission enquiry | Implemented and verified in code | Public and parent APIs |
| Counselling | Implemented and verified in code | Dedicated public lead endpoint |
| Parent child management | Implemented and verified in code | Child model and admissions route |
| Parent application documents/messages | Implemented but requires testing | Private routes and tracking tests exist |
| Parent notifications | Implemented but requires testing | In-app model/API and email integration |
| School admin profile | Implemented but requires testing | Approval and mine routes exist |
| School profile/content change queues | Implemented and verified in code | Models, services, and Django admin |
| School fee proposals/publication | Partially implemented | School routes exist; staff approval behavior and UI need end-to-end testing |
| School enquiry management | Implemented but requires testing | Scoped dashboard status route |
| Staff dashboard | Implemented and verified in code | Dedicated dashboard view |
| Main admin dashboard | Implemented and verified in code | Aggregations and Django Admin |
| Django user/role administration | Implemented and verified in code | Jazzmin/Django Admin |
| Reviews | Implemented and verified in code | Model, API, status moderation |
| Review display | Implemented but requires testing | Frontend moderation/read integration |
| Popularity scoring | Implemented but requires testing | Recalculation code and tests exist; Beat deployment missing |
| Featured promotions | Implemented and verified in code | One-to-one promotion model and admin sync |
| Blogs | Implemented and verified in code | Public API/frontend and staff Admin |
| Guides | Implemented and verified in code | Model/API/frontend |
| Newsletter subscribe | Implemented and requires testing | Public throttled endpoint |
| Email delivery | Implemented but requires testing | Depends on provider credentials and webhook |
| OTP login/register | Implemented but requires testing | Providers and fallback need live verification |
| Password reset | Implemented but requires testing | Email delivery dependency |
| Subscriptions/Razorpay | Partially implemented | Order, verify, webhook source exists; live payment/provider credentials unavailable |
| Celery worker/beat | Partially implemented | Code and schedule exist; Render blueprint defines Redis but no worker/beat services |
| Meilisearch | Partially implemented | Optional; fallback code exists; live index status unavailable |
| Cloudflare R2 | Implemented but requires testing | Settings/routes exist; live bucket credentials unavailable |
| Sentry | Cannot verify | Optional by environment |
| SEO sitemap and robots | Implemented and verified in code | Next route files exist |
| Canonical redirects | Implemented and tested as an E2E intent | Live redirect behaviour requires runtime check |

## Known implementation gaps and inconsistencies

1. Public engagement API accepts only three event types, despite shortlist and enquiry constants.
2. Render Redis is declared, but Celery worker/beat services are not.
3. A promotion saves `School.is_featured=True`, while public visibility also checks its live date window.
4. School Admin Django access and Next.js role access are separate; Django staff flags can expose or remove capability independently of `User.role`.
5. Public API and frontend route behaviour should be retested after deployment host changes.
6. Live Meilisearch, R2, Brevo/Resend, Razorpay, Redis, and Celery state are not encoded in source and cannot be verified locally.
7. No product-wide Next.js audit log or product-wide admin activity report is implemented.
8. No in-app MFA/device management/account deletion workflow is implemented.
9. Public and private media security should be tested with real R2 and private storage configurations.
10. Subscription billing implementation should be tested in Razorpay sandbox and then production webhook/reconciliation.

## Missing functionality

The repository does not clearly implement:

- A complete Next.js user and role management console
- Native in-product permissions editor
- Warehouse analytics/export
- A recommendation engine beyond popularity scoring
- Direct school purchase/promotional checkout
- A full support ticket/SIEM integration
- Product-wide audit export
- Automated application document virus/malware scanning

These are absent or cannot be verified from source, rather than assumed as planned features.
