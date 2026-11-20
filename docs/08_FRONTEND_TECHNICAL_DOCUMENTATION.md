# 8. Frontend technical documentation

The frontend is `frontend/`. It is a Next.js 14 App Router project. The API client is `frontend/lib/api.ts`. Styling is Tailwind plus global dashboard classes in `frontend/app/globals.css`.

## Folder structure

| Path | Role |
| --- | --- |
| `frontend/app/` | Routes and root layout |
| `frontend/components/` | Shared UI, school profile, dashboards, home, search |
| `frontend/components/home/` | Homepage sections |
| `frontend/components/parent-dashboard/` | Parent sections |
| `frontend/components/school-admin/` | School console |
| `frontend/components/dashboard/` | Shared dashboard shell, stat cards, empty and loading states |
| `frontend/components/search/` | Compare page and command palette |
| `frontend/lib/` | API, SEO slugs, media URLs, auth helpers |
| `frontend/vercel.json` | Frontend-local Vercel config |
| `vercel.json` | Repository-root Vercel build that runs inside `frontend/` when that folder exists |

## Routes

| Route | Kind | Main module |
| --- | --- | --- |
| `/` | Public | `HomeLanding` |
| `/{country}/...` | Public SEO | `app/[...segments]/page.tsx` |
| `/compare/` | Public | `ComparePage` |
| `/blogs`, `/blogs/[slug]`, category, preview | Public | Blog pages |
| `/guides`, `/guides/[slug]` | Public | Guide pages |
| `/about`, `/contact`, `/privacy`, `/terms`, `/cookies`, `/grievance`, `/reviews`, `/counselling` | Public | Static or form pages |
| `/fee-calculator`, `/fee-calculator/[schoolSlug]` | Public | Fee estimate |
| `/login`, `/signup`, `/signup/school`, `/verify-otp`, `/reset-password` | Auth | Forms calling `auth` in `api.ts` |
| `/unsubscribe/[token]` | Public | Preference token |
| `/dashboard` | Redirect by role | `app/dashboard/page.tsx` |
| `/dashboard/parent/...` | Parent | `ParentDashboard` |
| `/dashboard/school/...` | School admin | `SchoolAdminConsole` |
| `/dashboard/staff-admin` | Staff | Staff queue page |
| `/dashboard/admin` | Staff and super admin | Platform overview |

There is no `/dashboard/super-admin`. Super admins use `/dashboard/admin/` and Django Admin.

## Catch-all resolver

`app/[...segments]/page.tsx` is forced dynamic so listings are not frozen at build time. It:

1. Walks slug segments against countries, states, cities, and localities.
2. Detects school-type and board segments using `frontend/lib/seo-slugs.ts` and `frontend/lib/school-urls.ts`.
3. If the path matches a school profile (`isSchoolProfileSegmentPath`), it loads `schools.bySlug` and renders `SchoolProfile`.
4. Otherwise it renders `SchoolDiscovery` with the resolved filters.
5. `generateMetadata` builds the title, description, and canonical URL.

Profile section URLs use the ids in `frontend/lib/school-sections.ts` (`overview`, `fees`, `admissions`, `facilities`, `infrastructure`, `media`, `reviews`, `location`, `faq`).

## API service layer

`frontend/lib/api.ts` groups clients:

| Export | Backend area |
| --- | --- |
| `auth` | JWT, OTP, logout |
| `users` | Registration and profiles |
| `schools` | Schools, catalogues, by-slug, popular, mine |
| `geography` | Countries, states, cities, localities |
| `searchApi` | Suggestions |
| `fees` | Fee master and public estimate |
| `guideContent` | Guides |
| `blogs` | Posts, categories, subscribe |
| `admissions` | Enquiries and counselling |
| `parentChildren` | Children |
| `parentApplications` | Applications, documents, messages, profile |
| `reviews` | Reviews |
| `dashboards` | Parent, school, admin, staff |
| `savedSearches` | Saved searches |
| `notificationPreferences` | Email consent |
| `subscriptions` | Plans, orders, verify |
| `registerSchool`, `setSchoolVerification` | School signup and verification |

`authRequest` attaches the bearer token, refreshes once on 401, and retries. `configureAuthTokens` supplies the current token pair from client state. `fetchAllPages` walks paginated catalogue responses so filters can be built without a single huge payload.

Errors are normalised by `apiErrorMessage`.

## Authentication state

Login and OTP pages store access and refresh tokens in the browser and register them with `configureAuthTokens`. The access token is short-lived (15 minutes). The client refreshes through `POST /api/auth/jwt/token/refresh/`.

Role is read from the user payload returned after verification. `DashboardShell` receives an allowed role list and refuses other roles. `NavBar` shows dashboard links only for the signed-in role.

Protected routes are client-side. The Next.js server does not verify the JWT before rendering the dashboard shell. The API rejects unauthorised calls. A user who opens another role’s URL sees the shell’s denied state rather than that role’s data.

## Role navigation

`DashboardShell` `NAV_ITEMS`:

| Label | Path | Roles |
| --- | --- | --- |
| Parent dashboard | `/dashboard/parent/` | `PARENT` |
| School admin panel | `/dashboard/school/` | `SCHOOL_ADMIN` |
| Staff admin | `/dashboard/staff-admin/` | `STAFF_ADMIN`, `SUPER_ADMIN` |
| Platform admin | `/dashboard/admin/` | `STAFF_ADMIN`, `SUPER_ADMIN` |

Parent sections are buttons that change the section route. School sections do the same inside `SchoolAdminConsole`.

## Forms and validation

Forms are React components, not a separate form framework documented as a shared schema package. They post JSON to the API and show `apiErrorMessage` on failure. Server serializers are the authority:

- Phone numbers on the user model must match `+` optional and 9–15 digits.
- Counselling and enquiry endpoints validate required contact fields.
- Fee and review ranges are enforced in the models.
- OTP screens accept the code issued by email.

`CountryPhoneInput` is the shared phone control. Counselling location selection is `CounsellingLocationMultiSelect`.

## Media

`frontend/lib/school-media.ts` and `frontend/lib/profile-media.ts` turn stored URLs into renderable image sources. School images that point at the API media routes are loaded through `/media/schools/` or `/media/day-schools/`. The browser does not receive R2 credentials. Blog cover URLs come from the blog API. Parent profile photos are fetched as authenticated file responses, not as public gallery images.

## Search and filters

`SearchCommandPalette` calls suggestions as the visitor types. Listing filters are query parameters on the catch-all page and are sent as `SchoolFilter` fields. Empty suggestion queries shorter than two characters return empty arrays without an error.

## Loading, empty, and error states

`DashboardState` covers loading, error, and retry for dashboards. `ContentSkeleton` and `ParentOverviewSkeleton` are placeholders. Tables use `EmptyTableRow` when a queue is empty. Public listings render an empty state inside `SchoolDiscovery` when the API returns no schools. Failed API calls on the catch-all surface as not-found when the slug cannot be resolved, and as an error state when a known page cannot load data.

## Responsive design

Home, listing, profile, and dashboards use Tailwind breakpoints. `MobileTabBar` replaces dense header links on small screens. Comparison and dashboard tables sit in horizontal scroll containers (`dash-table-wrap`). The school map stacks under the address on narrow screens.

## SEO and metadata

`pageMetadata` in `frontend/lib/seo.ts` is the shared helper. Blog and guide pages implement `generateMetadata`. The catch-all page builds breadcrumbs and JSON-LD. Trailing slashes are normalised with `withTrailingSlash`. School slugs on the client must match the slug stored by `unique_school_slug`.

## Click-to-screen flow

Example: visitor opens a city listing and then a school.

1. Browser requests `/india/karnataka/bengaluru/`.
2. The catch-all page resolves country, state, and city by slug.
3. It calls `GET /api/schools/schools/?country=&state=&city=` (and type or board parameters when present).
4. `SchoolViewSet` applies `public_school_queryset` and `SchoolFilter`.
5. The response is paged and ordered.
6. `SchoolDiscovery` renders cards.
7. A card click sends `POST /api/schools/engagement/` with `LISTING_CLICK`, then navigates to the profile path.
8. The profile page calls `GET /api/schools/schools/by-slug/{slug}/`.
9. `SchoolProfile` renders sections from that payload. A detail view can send `SCHOOL_VIEW`.

Example: school admin saves the about text.

1. The console sends `PATCH /api/schools/schools/mine/` with the about field.
2. `submit_school_profile_changes` inserts `school_profile_changes`.
3. The live `schools.about` value is unchanged.
4. The UI treats HTTP 202 as “submitted for review”.
5. A staff user approves the row in Django Admin.
6. The public profile then shows the new about text.
