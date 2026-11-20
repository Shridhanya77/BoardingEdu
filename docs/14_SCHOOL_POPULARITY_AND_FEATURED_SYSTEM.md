# 14. School popularity and featured schools

## Popularity implementation

The popularity system uses raw engagement rows, configured weights, a rolling window, exponential decay, and verified published review quality. It is recalculated by `refresh_school_popularity`.

## Accepted engagement events

The public event API accepts only:

- `SCHOOL_VIEW`
- `LISTING_CLICK`
- `COMPARE_ADD`

Additional event constants exist for shortlist and enquiry:

- `SHORTLIST_ADD`
- `ENQUIRY_SUBMIT`

Those values are not accepted by the public `/api/schools/engagement/` input unless the implementation is extended. Their backend scorer still includes them when rows are written by another code path.

## Identity and deduplication

For authenticated users, the identity is `user:{user.pk}`. For visitors, the backend signs a random UUID in the `be_visitor` cookie and builds `visitor:{uuid}`.

Both identities are converted to an HMAC SHA-256 hash. A session UUID from `X-Engagement-Session` is separately hashed. Raw visitor and session identifiers are not stored as their original values.

`record_school_engagement()` uses:

- school
- event type
- identity hash
- UTC date as `dedupe_bucket`

It uses `get_or_create`, so one identity has one row for an event in a single UTC date. It sets `suspicious=True` when the same identity already has 30 or more engagement rows in the preceding hour.

The suspicious flag is stored but is not currently excluded from popularity calculation.

## Throttling

The engagement view applies visitor and IP throttles:

- `SchoolEngagementVisitorThrottle`
- `SchoolEngagementIPThrottle`

The exact configured limits are in `backend/apps/schools/throttles.py`.

## Rolling window and decay

`SchoolPopularityConfig` uses a singleton row with `config_id=1`. Defaults and editable fields are defined in `SchoolPopularityConfig`:

- rolling window days
- half-life days
- quality weight
- review saturation count

During recalculation, each event row is reduced to the latest row by school, event type, and identity. The engagement contribution uses exponential decay:

```text
weight * 2^(-age_in_days / half_life_days)
```

This is implemented in `apps/schools/engagement.py`. Events outside the rolling window are excluded and later deleted by the hourly task.

## Engagement counts and score

The recalculator maintains:

- unique school views
- unique listing clicks
- unique comparisons
- unique shortlists
- unique enquiries

It applies the configured enabled weight for each event type. A disabled weight is zero.

The final stored popularity score is:

```text
popularity_score = engagement_score + quality_score
```

where `engagement_score` is the decayed configured weighted sum.

## Review quality

Only reviews that satisfy all of the following contribute:

- school is publicly active
- review status is `APPROVED`
- `is_verified=True`

The average 1–5 rating is divided by 5. Review confidence is `min(review_count / review_saturation_count, 1)`. Quality score is:

```text
quality_weight * (average_rating / 5) * review_confidence
```

Review count and average come from the `Review` table.

## Stored popularity

`SchoolPopularity` stores:

- overall score
- engagement score
- quality score
- unique counts by event
- window start
- calculated time

The table is updated by conflict when recalculation runs.

## Ranking

The public school viewset has a popular action and popularity joins. `SchoolPopularity.popularity_score` is used for ordering, with school name and ID tie-breakers. Exact frontend and API parameters should be verified against the live viewset/filter implementation before operational tuning.

## Scheduled recalculation

Celery beat schedule in `config/settings.py` defines:

- hourly `refresh_school_popularity`
- every six hours `deliver_saved_search_alerts`

The task purges engagement rows older than the rolling window after recalculation.

With Redis absent, Celery tasks can run eagerly inside the web process. In the Render blueprint, no separate Celery worker or beat service is declared. Therefore scheduled recalculation is not confirmed available on the deployed Render blueprint without an additional worker/beat service.

## Featured schools

`FeaturedPromotion` is a staff-managed, one-to-one record on `School`.

Fields include:

- label: `FEATURED` or `SPONSORED`
- priority
- heading
- banner URL
- description
- highlight lines
- active flag
- optional start date
- optional end date

Saving the promotion sets `School.is_featured=True`. Deleting it clears the flag.

Public featured visibility also supports legacy `School.is_featured=True` when no promotion row exists. For a promotion row, the row must be active and inside its date window; stale boolean flags do not override that rule.

## Admin configuration

Staff can edit:

- event weights and enabled state
- rolling window
- half-life
- quality weight
- review saturation count
- featured promotions

The Django admin also shows the latest popularity row and engagement rows.
