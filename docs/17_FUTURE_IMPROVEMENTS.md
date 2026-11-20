# 17. Future improvements

These are recommendations based on gaps in the verified implementation. They should not be interpreted as already implemented.

## Deployment reliability

- Add explicit Celery worker and beat services to Render or replace them with a managed scheduler.
- Add deployment smoke tests for migrations, `/healthz`, `/readyz`, `/api/`, and the frontend-to-backend proxy.
- Run search-index rebuild and school-popularity recalculation immediately after deployment as observable operations.
- Use separate staging and production databases, Redis instances, R2 buckets, and email providers.

## Testing

- Run backend tests in an isolated PostgreSQL test database.
- Expand frontend Vitest coverage for API URL mapping and engagement headers.
- Add Playwright journeys for registration, login, shortlist, compare, enquiry, parent applications, school-admin changes, and moderation.
- Add API contract tests from `/api/schema/`.
- Test permission denial, object-level ownership, and Django Admin scoping.

## Observability

- Enable and monitor Sentry in production.
- Add structured application logs with request ID and role.
- Create dashboards for API errors, OTP delivery, email delivery, Celery task failures, and payment webhooks.
- Add a product-wide audit trail for verification, moderation, role changes, profile edits, and permission changes.

## Authentication

- Consider MFA for staff and super administrators.
- Add account/session management for logged-in devices.
- Add explicit account lockout or progressive cooldown UX.
- Document and test OTP fallback behavior in database versus Redis modes.
- Add account deletion/export workflow if required by policy.

## School operations

- Improve staff approval queues with bulk actions and side-by-side proposed/current fields.
- Surface school profile completeness and publication blockers in the Next.js school console.
- Provide a clear approval history for every proposed change.
- Add media upload rather than URL-only entry where privacy and R2 paths permit.
- Clarify whether school-admin fee proposals can create or only modify structures.

## Admissions

- Add application deadlines and status automation.
- Add parent-visible document requirements and rejection reasons.
- Add scheduled follow-up reminders for staff.
- Define SLA and assignment rules.
- Scan and validate uploaded documents.
- Add export, pagination, and bulk lead assignment for CRM operators.

## Popularity

- Decide whether `SHORTLIST_ADD` and `ENQUIRY_SUBMIT` should be accepted by the public engagement endpoint.
- Decide whether suspicious engagement rows should receive a lower or zero weight.
- Add a recalculation history dashboard and stale-score health check.
- Add alerting when no worker or beat run occurs.
- Expose configured weights and windows only to authorised staff.

## Search and content

- Monitor Meilisearch index drift and add scheduled rebuild reconciliation.
- Add search analytics and typo handling.
- Add draft approval workflow for blogs and guides.
- Add scheduled publishing and consistent canonical metadata.
- Add media alt text and image dimension optimization checks.

## Subscriptions

- Add payment reconciliation and idempotency reporting.
- Define lead-access quota behavior in detail.
- Add renewal, failure, cancellation, and refund states to the UI.
- Add sandbox and production provider-runbooks.

## Product UX

- Improve cross-route consistency for `/schools/...`, slug, and city/board URL aliases.
- Standardize loading, empty, error, and retry components.
- Add parent account settings and notification controls to one cohesive surface.
- Add data export and privacy controls.

## Security and governance

- Establish a secrets rotation schedule.
- Add least-privilege Django permissions for staff roles.
- Retain verification and moderation reasons for audit.
- Add file size/type/virus validation for uploads.
- Perform regular dependency, OWASP, and penetration testing.
