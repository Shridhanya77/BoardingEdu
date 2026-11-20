# 3. Public website

Public pages live in `frontend/app/`. Almost every school and place URL is handled by the catch-all route `frontend/app/[...segments]/page.tsx` (`dynamic = "force-dynamic"`). That page resolves slugs against the geography and school APIs. Unknown slugs call `notFound()`.

Navigation is `frontend/components/NavBar.tsx`. The mobile bar is `frontend/components/home/MobileTabBar.tsx`. Footer SEO links are `frontend/components/home/SiteFooterSeo.tsx`.

## Home page

Route: `/` (`frontend/app/page.tsx`), composed by `frontend/components/home/HomeLanding.tsx`.

| Section | Component | What the visitor sees and can do |
| --- | --- | --- |
| Header | `NavBar` | Home, Explore Schools (`/india/`), Guides, Compare. Signed-in users also see their dashboard link |
| Search | `GlobalSearchPalette` / `SearchCommandPalette` | Type at least 2 characters. Calls `GET /api/search/suggestions/?q=` |
| Category cards | `HomeCategoryCards` | Day schools and boarding schools. Links use `schoolDirectoryPath()` |
| Featured schools | `FeaturedSchoolCarousel`, `FeaturedSchoolCards`, `FeaturedPromoBanner` | Schools returned with `is_featured=true`, ordered by promotion priority |
| Counselling prompt | `HomeCounsellingPrompt`, `CounsellingSection`, `CounsellingModal` | Opens a counselling form |
| Parent tools | `ParentTools` | Points families toward an account, shortlist, and compare |
| Footer | `SiteFooterSeo` | Place, board, and policy links |

`GET /api/public/statistics/` and `GET /api/dashboards/public/summary/` expose public platform counts used as summary figures. They do not include personal data.

## Explore and SEO listings

The catch-all route understands paths such as:

| Pattern | Meaning |
| --- | --- |
| `/india/` | Country listing |
| `/india/{state}/` | State listing |
| `/india/{state}/{city}/` | City listing |
| `/india/{state}/{city}/{locality}/` | Locality listing |
| Paths with a school-type segment | Day, day-boarding, or residential filter |
| Board listing helpers in `frontend/lib/school-urls.ts` | Board-scoped directory |
| A final school slug | School profile, including section suffixes |

Home categories in the API are `day-school` and `residential-school`. `boarding-schools` is accepted as an alias. A school type whose code, slug, or name matches day-boarding is included in both families (`home_school_categories` in `querysets.py`).

Listing UI is `SchoolDiscovery` and `SchoolLocationResults`. Cards show name, location, boards, school type, image, fee summary when a published fee exists, and rating when published reviews exist. Clicking a card records a listing engagement event and opens the profile.

Filters on the directory map to `SchoolFilter`:

| Filter | Query parameter |
| --- | --- |
| Country, state, city, locality | `country`, `state`, `city`, `location` (UUIDs) |
| Several states in one country | `location_group` as `countryUuid|stateUuid,stateUuid` |
| Board | `board` (repeatable) |
| School type | `school_type` |
| Home category | `home_category` |
| Grade offered and active | `grade` |
| Gender | `gender` (`COED`, `BOYS`, `GIRLS`) |
| Featured | `is_featured` |
| Fee range | `min_fee`, `max_fee` against the annotated starting annual fee |
| Text | `search` on name, code, address, city, board |

Sort fields include `school_name`, `established_year`, `annual_fee`, `average_rating`, `review_count`, and `is_featured`. Schools with no fee or rating sort last.

The popular list is `GET /api/schools/schools/popular/?page_size=`. If no school in the filtered set has an engagement score above zero, the endpoint falls back to verified published review averages, then rating and review count. `page_size` must be 1 to 50.

## Search suggestions

`GET /api/search/suggestions/?q=&limit=`

- Minimum query length is 2.
- Default limit 8, maximum 20.
- `schools`: active schools. Meilisearch order is kept when the index responds. Otherwise the database matches name, short name, and slug, preferring names that start with the query.
- `locations`: states, cities, and localities, each with a count of active schools.

The palette is shared by the homepage and listing pages (`frontend/lib/search-experience.tsx`, `frontend/lib/search-palette.ts`).

## School profile

Component: `frontend/components/SchoolProfile.tsx`. Data: `GET /api/schools/schools/by-slug/{slug}/`.

Sections (`frontend/lib/school-sections.ts`):

| Section | Contents actually rendered from the API |
| --- | --- |
| Overview | Name, tagline, about, gender, established year, student-teacher ratio, boards, types, principal name |
| Fees | Published fee structure and items, plus `SchoolFeeSummary` / `SchoolFeesAndGrades` |
| Admissions | Whether `admission_open` is true, brochure and required-document links from `SchoolAdmissionResource`, enquiry button |
| Facilities | Available `SchoolFacility` rows grouped by facility category (academic, sports, accommodation, dining, health, safety, transport, technology, and any other category stored) |
| Infrastructure | Capacity-style facility notes and the same facility data presented for campus infrastructure. There is no separate infrastructure table |
| Photos and videos | Active `SchoolPhoto` and `SchoolVideo` rows. Gallery component: `SchoolPhotoGallery` |
| Reviews | Published reviews only, plus a form for a signed-in parent |
| Location | Address, map (`SchoolMap`) when latitude and longitude exist |
| FAQ | Published `SchoolFAQ` rows that match the school’s place, board, or type, plus general FAQs |

Profile actions (`SchoolProfileActions`, `SchoolShortlistButton`):

| Control | Result |
| --- | --- |
| Enquire / Apply | Opens `SchoolEnquiryDialog`. Guests submit contact fields. Parents can attach a child |
| Shortlist | Requires a parent login. `POST /api/dashboards/parent/shortlist/` |
| Compare | Adds the school to the compare selection and can open `/compare/` |
| Share / copy link | Uses the canonical profile path from `schoolProfilePath` |
| Fee calculator | `/fee-calculator/{schoolSlug}/` calls the public fee estimate API |

Recent views for a logged-in parent are recorded by `RecentSchoolTracker` into `parent_recent_school_views`.

Detail views, listing clicks, and compare-adds call `POST /api/schools/engagement/`. Shortlist and enquiry events are recorded by the server, not by that public endpoint.

## Compare

Route: `/compare/` (`frontend/components/search/ComparePage.tsx`).

The page loads the selected school details and shows them side by side (identity, location, boards, fees, facilities, ratings). It does not create a saved comparison record in the database. Adding a school records `COMPARE_ADD` once per visitor per school per UTC day.

## Shortlist and favourites

There is one saved-school feature: `ParentShortlist`. Visitors see the button. Only a parent account persists the school. There is no separate “favourites” model.

## Admission enquiry

`POST /api/admissions/enquiries/` (public create is allowed; throttled at 10 per hour).

A guest sends name, email, phone, child details, school, academic year, optional grade, and message. A logged-in parent can link `parent_profile` and `child`. The server assigns `enquiry_code`, default CRM status `NEW`, and application status `SUBMITTED`. A status event is written by `sync_application_timeline`. An `ENQUIRY_SUBMIT` engagement row is created.

The parent later tracks the same row under My Applications. A guest has no tracking page unless they later register with the same identity; the code does not automatically attach old guest enquiries.

## Counselling

Routes: `/counselling/` and the home modal.

`POST /api/admissions/counselling-requests/` is public, throttled at 5 per hour. Fields include parent name, phone, optional email, home city, preferred country, states, cities, grades, school types, boards, an optional school, and a message. Status starts at `NEW`. Staff update it in Django Admin (`CounsellingRequestAdmin`). This does not create an `AdmissionEnquiry`.

## Blogs

| Route | API |
| --- | --- |
| `/blogs/` | `GET /api/blogs/` |
| `/blogs/{slug}/` | `GET /api/blogs/{slug}/` |
| `/blogs/category/{slug}/` | `GET /api/blogs/category/{slug}/` |
| `/blogs/preview/{slug}/` | `GET /api/blogs/preview/{slug}/` for unpublished preview |

Published means status `published`, `published_at` in the past, and an active category. Posts have meta title, meta description, canonical URL, cover image, reading time, and related posts from the same category. Subscribe: `POST /api/blogs/subscribe/` (5 per hour) into `blog_subscribers`.

## Guides

| Route | API |
| --- | --- |
| `/guides/` | `GET /api/guides/categories/` and `/api/guides/articles/` |
| `/guides/{slug}/` | Article detail |

Only articles with `status=True` are public. Body content is a JSON list of `{heading, body[]}` validated on the model. Pages revalidate on a one-hour constant (`GUIDE_CONTENT_REVALIDATE_SECONDS`).

## Static information pages

| Route | Purpose |
| --- | --- |
| `/about/` | About the platform |
| `/contact/` | Contact details |
| `/privacy/` | Privacy policy |
| `/terms/` | Terms |
| `/cookies/` | Cookie notice |
| `/grievance/` | Grievance information |
| `/reviews/` | Reviews entry page |
| `/fee-calculator/` | Fee calculator landing |
| `/unsubscribe/{token}/` | One-click email unsubscribe |

These are content pages. They do not manage school records.

## Accounts entry points

| Route | Behaviour |
| --- | --- |
| `/login/` | Email or username, then OTP for parents and school admins |
| `/signup/` | Parent registration |
| `/signup/school/` | School self-registration |
| `/verify-otp/` | Submits the email code |
| `/reset-password/` | Request and confirm password reset |

## Responsive behaviour

Layouts use Tailwind. `MobileTabBar` is the small-screen primary navigation. Dashboard shells collapse their section navigation for narrow widths. School cards stack vertically on small screens and use a denser grid on wide screens. The map and comparison table scroll horizontally when the viewport is narrower than the table.

## SEO

`generateMetadata` on the catch-all and content routes builds titles and descriptions from listing copy in `frontend/lib/seo.ts`. Breadcrumb JSON-LD is emitted through `JsonLd` and `breadcrumbJsonLd`. School slugs are normalised by `apps.schools.slug_utils.seo_slug` and `unique_school_slug`. UUID-shaped slugs are replaced on save. Canonical public paths are built in `frontend/lib/school-profile-route.ts` and `frontend/lib/school-urls.ts`.
