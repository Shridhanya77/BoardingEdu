// Central BoardingEdu DRF API client — single source of truth
const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;
if (!configuredApiBase && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_API_BASE must be set to the deployed API URL.");
}

export const API_BASE = (
  configuredApiBase ?? "https://boardingedu-production-ac84.up.railway.app/api"
).replace(/\/+$/, "");
const API_ORIGIN = new URL(API_BASE).origin;
const API_PATH = new URL(API_BASE).pathname.replace(/\/+$/, "");

export function apiRequestUrl(path: string): URL {
  const url = path.startsWith("http") ? new URL(path) : new URL(`${API_BASE}${path}`);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith(`${API_PATH}/`)) {
    throw new Error("The API returned a URL outside the configured API base.");
  }
  if (typeof window === "undefined") return url;

  const endpointPath = url.pathname
    .slice(API_PATH.length)
    .replace(/^\/+|\/+$/g, "");
  const browserUrl = new URL(`/backend-api/${endpointPath}`, window.location.origin);
  browserUrl.search = url.search;
  return browserUrl;
}

const defaultHeaders = { "Content-Type": "application/json" };
const browserGetCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Human-readable message from any thrown API error. Pulls `detail` (or the
 * first field error) out of the DRF response body instead of echoing the URL.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body;
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      if (typeof record.detail === "string") return record.detail;
      for (const value of Object.values(record)) {
        const first = Array.isArray(value) ? value[0] : value;
        if (typeof first === "string" && first.trim()) return first;
      }
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function parseBody(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

/**
 * Low-level unauthenticated request. Used for public endpoints and the
 * auth.token/register methods that do not need a bearer token.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = apiRequestUrl(path);

  const cacheKey = (init.method ?? "GET").toUpperCase() === "GET" && typeof window !== "undefined"
    ? url.href
    : null;
  if (cacheKey) {
    const cached = browserGetCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;
    if (cached) browserGetCache.delete(cacheKey);
  }

  const operation = (async () => {
    const res = await fetch(url, {
      ...init,
      headers: { ...defaultHeaders, ...init.headers },
      cache: "no-store",
    });
    if (!res.ok) {
      const parsed = await parseBody(res);
      const detail = typeof parsed === "string"
        ? parsed
        : (parsed && typeof parsed === "object" && "detail" in parsed
          ? String((parsed as { detail: unknown }).detail)
          : JSON.stringify(parsed));
      throw new ApiError(res.status, `API ${res.status} on ${path}: ${detail}`, parsed);
    }
    return await res.json();
  })();

  if (cacheKey) {
    const entry = { expiresAt: Date.now() + 60_000, promise: operation };
    browserGetCache.set(cacheKey, entry);
    if (browserGetCache.size > 100) {
      const oldestKey = browserGetCache.keys().next().value;
      if (oldestKey) browserGetCache.delete(oldestKey);
    }
    operation.catch(() => {
      if (browserGetCache.get(cacheKey) === entry) browserGetCache.delete(cacheKey);
    });
  }
  return operation as Promise<T>;
}

/**
 * Authenticated request wrapper — used by ANY client-side endpoint that
 * needs a JWT. Reads tokens from a simple pluggable "tokens provider" so
 * this file stays framework-agnostic.
 *
 * On 401 + a refresh token being available, we do ONE transparent refresh
 * and retry the original request exactly once.
 *
 * On the server side (Next.js SSR — no localStorage), use plain request<T>.
 */
export type Tokens = { access: string; refresh: string };
export type TokensProvider = {
  get(): Tokens | null;
  set(tokens: Tokens): void;
  clear(): void;
};
let tokensProvider: TokensProvider | null = null;
export function configureAuthTokens(provider: TokensProvider | null) {
  tokensProvider = provider;
}

export async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const provider = tokensProvider;
  if (!provider) {
    throw new ApiError(500, "Auth tokens provider not configured — call configureAuthTokens() once at app boot.");
  }

  const url = apiRequestUrl(path);

  const buildInit = (access: string): RequestInit => ({
    ...init,
    headers: {
      ...defaultHeaders,
      ...init.headers,
      Authorization: `Bearer ${access}`,
    },
  });

  // First try with the current access token
  let tokens = provider.get();
  if (!tokens) {
    throw new ApiError(401, "You must be logged in to perform this action.");
  }
  let res = await fetch(url, buildInit(tokens.access));
  if (res.status === 401 && tokens.refresh) {
    // ---- Single transparent refresh retry ----
    try {
      const refreshed = await request<{ access: string; refresh?: string }>("/auth/jwt/token/refresh/", {
        method: "POST",
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      const nextTokens: Tokens = { access: refreshed.access, refresh: refreshed.refresh ?? tokens.refresh };
      provider.set(nextTokens);
      tokens = nextTokens;
      res = await fetch(url, buildInit(nextTokens.access));
    } catch (refreshErr) {
      provider.clear();
      throw refreshErr instanceof ApiError ? refreshErr : new ApiError(401, "Failed to renew session.");
    }
  }
  if (!res.ok) {
    const parsed = await parseBody(res);
    const detail = typeof parsed === "string"
      ? parsed
      : (parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : JSON.stringify(parsed));
    throw new ApiError(res.status, `API ${res.status} on ${path}: ${detail}`, parsed);
  }
  return (await res.json()) as Promise<T>;
}

// ---------- Auth (JWT, SimpleJWT w/ rotation enabled on BE) ----------
export const auth = {
  obtain: (username: string, password: string) =>
    request<{ access: string; refresh: string }>("/auth/jwt/token/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  refresh: (refreshToken: string) =>
    request<{ access: string; refresh?: string }>("/auth/jwt/token/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
    }),
  verify: (token: string) =>
    request<Record<string, never>>("/auth/jwt/token/verify/", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  /** GET /users/users/me/ — requires a valid JWT (use via authRequest wrapper). */
  me: () => authRequest<UserDetail>("/users/users/me/"),
};

// ---------- Users (registration) ----------
export type UserRole = "PARENT" | "SCHOOL_ADMIN" | "STAFF_ADMIN" | "SUPER_ADMIN";
export type UserDetail = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  role_display: string;
  phone: string;
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  parent_profile: { address: string; occupation: string; preferred_contact_method: "EMAIL" | "PHONE" | "WHATSAPP" } | null;
  school_admin_profile: { school_id: string | null; school_code: string | null; school_name: string | null; school_slug?: string | null; school_verification_status?: "UNVERIFIED" | "PENDING" | "VERIFIED" | null; designation: string } | null;
  staff_admin_profile: { designation: string; department: string } | null;
};
export type RegisterInput = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  password: string;
  password_confirm: string;
  address?: string;
  occupation?: string;
  preferred_contact_method?: "EMAIL" | "PHONE" | "WHATSAPP";
};
export const users = {
  /** Public Parent registration (role is locked to PARENT on the server). Returns the created user row. */
  register: (payload: RegisterInput) =>
    request<UserDetail>("/users/users/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ---------- Schools ----------
export type SchoolListItem = {
  school_id: string;                  // UUID
  school_code: string;
  school_name: string;
  short_name: string;
  school_logo_url?: string;
  school_image_url?: string;
  school_photos?: SchoolPhotoListItem[];
  videos_count?: number;
  slug: string;
  country_id: string; country_name: string;
  state_id: string;   state_name: string;
  city_id: string;    city_name: string;
  country_slug: string;
  state_slug: string;
  city_slug: string;
  location_id: string | null; location_name: string | null; location_slug?: string | null;
  boards_detail: BoardListItem[];
  school_types_detail: SchoolTypeListItem[];
  board_id: string | null; board_name: string | null;
  school_type_id: string | null; school_type_name: string | null;
  gender: string;                              // "Co-Ed" etc (display, NOT raw enum)
  verification_status: string;                 // "Verified" etc
  pincode: string | null; address: string | null;
  lat: number | null; lng: number | null;
  phone: string | null; email: string | null;
  website?: string;
  principal_name: string | null;
  tagline?: string;
  about?: string;
  admission_open?: boolean;
  seo_keywords?: string[];
  established_year: number | null;
  annual_fee: string | null;
  average_rating: number | null;
  review_count: number;
  academics_rating?: number | null;
  facilities_rating?: number | null;
  safety_rating?: number | null;
  communication_rating?: number | null;
  grades_range?: string | null;
  boarding_required: boolean;
  is_featured: boolean;
  status: boolean;
  published_at: string | null;
};

export type PaginatedResponse<T> = {
  count?: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
export type CountryListItem = {
  country_id: string;
  country_code: string;
  country_name: string;
  slug: string;
  status: boolean;
  created_at: string;
  updated_at: string;
};
export type StateListItem = {
  state_id: string;
  country_id: string;
  country_code: string;
  country_name: string;
  state_code: string;
  state_name: string;
  slug: string;
  status: boolean;
  created_at: string;
  updated_at: string;
};
export type CityListItem = {
  city_id: string;
  state_id: string;
  state_code: string;
  state_name: string;
  country_id: string;
  country_code: string;
  country_name: string;
  country_slug?: string;
  state_slug?: string;
  city_code: string;
  city_name: string;
  schools_count?: number;
  slug: string;
  status: boolean;
  created_at: string;
  updated_at: string;
};
export type LocationListItem = {
  location_id: string;
  city_id: string;
  city_code: string;
  city_name: string;
  state_id: string;
  state_code: string;
  state_name: string;
  country_id: string;
  country_code: string;
  country_name: string;
  location_code: string;
  location_name: string;
  slug: string;
  status: boolean;
  created_at: string;
  updated_at: string;
};
export type SchoolFilters = {
  search?: string;
  country?: string;
  state?: string;
  city?: string;
  location?: string;
  location_group?: string[];
  school_type?: string | string[];
  home_category?: "day-school" | "boarding-schools" | "residential-school";
  board?: string | string[];
  grade?: string | string[];
  min_fee?: number;
  max_fee?: number;
  gender?: "COED" | "BOYS" | "GIRLS";
  status?: boolean;
  is_featured?: boolean;
  page?: number;
  page_size?: number;
  ordering?:
    | "school_name" | "-school_name"
    | "established_year" | "-established_year"
    | "annual_fee" | "-annual_fee"
    | "average_rating" | "-average_rating"
    | "review_count" | "-review_count"
    | "is_featured" | "-is_featured"
    | "created_at" | "-created_at";
};
export type SchoolTypeListItem = {
  school_type_id: string;
  type_code: string;
  type_name: string;
  slug: string;
  status: boolean;
};
export type BoardListItem = {
  board_id: string;
  board_code: string;
  board_name: string;
  slug: string;
  status: boolean;
};
export type GradeListItem = {
  grade_id: string;
  grade_code: string;
  grade_name: string;
  sort_order: number;
  status: boolean;
};
export type SchoolFAQListItem = {
  faq_id: string;
  question: string;
  answer: string;
};

export type SchoolPhotoListItem = {
  photo_id: string;
  photo_url: string;
  caption: string;
  alt_text: string;
  category: string;
  sort_order: number;
};

export type SchoolVideoListItem = {
  video_id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  category: string;
  sort_order: number;
};

export async function fetchAllPages<T>(firstPage: PaginatedResponse<T>, maxPages = 1000): Promise<T[]> {
  const items = [...firstPage.results];
  let next = firstPage.next;
  let pages = 1;
  const visited = new Set<string>();
  while (next && pages < maxPages) {
    if (visited.has(next)) {
      throw new Error("The API returned a repeated pagination URL.");
    }
    visited.add(next);
    const page = await request<PaginatedResponse<T>>(next);
    items.push(...page.results);
    next = page.next;
    pages += 1;
  }
  return items;
}
export type SchoolDetail = Omit<
  SchoolListItem,
  | "country_id" | "country_name" | "state_id" | "state_name"
  | "city_id" | "city_name" | "location_id" | "location_name"
  | "board_id" | "board_name" | "school_type_id" | "school_type_name"
  | "annual_fee"
  | "verification_status"
> & {
  country: string;
  country_detail: CountryListItem;
  state: string;
  state_detail: StateListItem;
  city: string;
  city_detail: CityListItem;
  location: string | null;
  location_detail: LocationListItem | null;
  boards: string[];
  boards_detail: BoardListItem[];
  school_types: string[];
  school_types_detail: SchoolTypeListItem[];
  board: string | null;
  board_detail: BoardListItem | null;
  school_type: string | null;
  school_type_detail: SchoolTypeListItem | null;
  gender: string;
  verification_status: string;
  created_at: string;
  updated_at: string;
  grades_offered_detail: {
    school_grade_id: string;
    grade_id: string;
    grade_code: string;
    grade_name: string;
    sort_order: number;
    seats_available: number | null;
    entry_age_min: number | null;
    entry_age_max: number | null;
  }[];
  facilities_detail: {
    school_facility_id: string;
    facility_id: string;
    facility_code: string;
    facility_name: string;
    category: string;
    icon_url: string | null;
    quantity_or_capacity: number | null;
    description: string | null;
  }[];
  photos_detail: {
    photo_id: string;
    photo_url: string;
    caption: string;
    alt_text: string;
    category: string;
    sort_order: number;
  }[];
  videos_detail: SchoolVideoListItem[];
};

export const schools = {
  list: (filters: SchoolFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, item));
      } else if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    return request<PaginatedResponse<SchoolListItem>>(
      `/schools/schools/${query ? `?${query}` : ""}`,
    );
  },
  page: (url: string) => request<PaginatedResponse<SchoolListItem>>(url),
  types: () => request<PaginatedResponse<SchoolTypeListItem>>("/schools/school-types/"),
  boards: () => request<PaginatedResponse<BoardListItem>>("/schools/boards/"),
  grades: () => request<PaginatedResponse<GradeListItem>>("/schools/grades/"),
  faqs: (filters: Partial<Record<"country" | "state" | "city" | "location" | "board" | "school_type", string>> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.toString();
    return request<SchoolFAQListItem[]>(`/schools/faqs/${query ? `?${query}` : ""}`);
  },
  retrieve: (uuid: string) => request<SchoolDetail>(`/schools/schools/${uuid}/`),
  /**
   * Direct slug lookup via the dedicated backend by-slug endpoint.
   * One DB hit, one HTTP round-trip (no more list+search+loop).
   * Returns the full SchoolDetail with nested facilities and grades.
   */
  bySlug: (slug: string) => request<SchoolDetail>(`/schools/schools/by-slug/${encodeURIComponent(slug)}/`),
  mine: () => authRequest<SchoolPortalData>("/schools/schools/mine/"),
  updateMine: (payload: SchoolPortalUpdate) =>
    authRequest<SchoolPortalData>("/schools/schools/mine/", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

// ---------- Geography (cascading dropdowns) ----------
export const geography = {
  countries: () => request<PaginatedResponse<CountryListItem>>("/geography/countries/"),
  cities: () => request<PaginatedResponse<CityListItem>>("/geography/cities/"),
  locations: () => request<PaginatedResponse<LocationListItem>>("/geography/locations/"),
  statesOf: (countryId: string) =>
    request<PaginatedResponse<StateListItem>>(`/geography/countries/${countryId}/states/`),
  citiesOf: (stateId: string) =>
    request<PaginatedResponse<CityListItem>>(`/geography/states/${stateId}/cities/`),
  locationsOf: (cityId: string) =>
    request<PaginatedResponse<LocationListItem>>(`/geography/cities/${cityId}/locations/`),
  searchCities: (query: string) =>
    request<PaginatedResponse<CityListItem>>(
      `/geography/cities/?search=${encodeURIComponent(query)}`,
    ),
};

// ---------- Admissions Enquiries (Parent & Guest submissions) ----------
export type EnquirySource = "WEBSITE" | "GOOGLE" | "REFERENCE" | "EXPO" | "OTHER";
export type EnquiryStatus =
  | "NEW"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "CALL_BACK"
  | "CONVERTED"
  | "CLOSED_LOST"
  | "SPAM";
export type EnquiryPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type NewEnquiryInput = {
  school: string;
  child?: string;
  academic_year?: string;
  applying_for_grade?: string;
  applying_for_grade_name?: string;
  source?: EnquirySource;
  priority?: EnquiryPriority;
  message?: string;
  child_name?: string;
  child_dob?: string;
  child_gender?: "BOY" | "GIRL" | "MALE" | "FEMALE" | "OTHER";
  parent_email?: string;
  parent_phone?: string;
  parent_full_name?: string;
};

export type EnquiryListItem = {
  enquiry_id: string;
  enquiry_code: string;
  status: EnquiryStatus;
  priority: EnquiryPriority;
  created_at: string;
  message: string | null;
  school: string;
  school_id: string;
  school_name: string;
  academic_year_code: string | null;
  applying_for_grade_display: string | null;
  child_display_name: string | null;
  guest_full_name: string;
  guest_email: string;
  guest_phone: string;
};

export type CounsellingRequestInput = {
  parent_name: string;
  email: string;
  phone: string;
  home_city?: string;
  preferred_country?: string;
  preferred_state?: string;
  preferred_cities: string[];
  grades: string[];
  school_types?: string[];
  boards?: string[];
  preferred_school?: string;
  message?: string;
};

export type CounsellingRequestResult = {
  request_id: string;
  reference: string;
  status: "NEW" | "CONTACTED" | "CLOSED";
  created_at: string;
};

export type FeeStructureListItem = {
  id: string;
  structure_code: string;
  structure_name: string;
  school_id: string;
  school_code: string;
  school_name: string;
  academic_year_id: string;
  academic_year_code: string;
  effective_from: string;
  effective_to: string | null;
  payment_terms_id: string | null;
  payment_terms_name: string | null;
  status: boolean;
  published: boolean;
};

export type FeeItemListItem = {
  id: string;
  fee_structure_id: string;
  fee_structure_code: string;
  item_code: string;
  item_name: string;
  category: string;
  grade_id: string | null;
  grade_name: string | null;
  school_type_id: string | null;
  school_type_name: string | null;
  amount: string | null;
  payment_frequency: "ONE_TIME" | "ANNUAL" | "QUARTERLY" | "HALF_YEARLY" | "TERM" | "MONTHLY" | "BY_DISTANCE" | "DYNAMIC";
  payment_frequency_display: string;
  description: string;
  tax: string;
  is_refundable: boolean;
  sort_order: number;
};

export const fees = {
  structuresForSchool: (schoolId: string) =>
    request<PaginatedResponse<FeeStructureListItem>>(
      `/fees/fee-structures/?school=${encodeURIComponent(schoolId)}&status=true&published=true`,
    ),
  itemsForStructure: (structureId: string, gradeId?: string) =>
    request<PaginatedResponse<FeeItemListItem>>(
      `/fees/fee-items/?fee_structure=${encodeURIComponent(structureId)}${gradeId ? `&grade=${encodeURIComponent(gradeId)}` : ""}`,
    ),
};

export const admissions = {
  /**
   * Submit a new admission enquiry. Auth NOT required (guest enquiries allowed).
   * If the caller is an authenticated PARENT, the backend auto-links their
   * parent_profile_id to the new enquiry record.
   */
  createEnquiry: (payload: NewEnquiryInput) => {
    const init: RequestInit = {
      method: "POST",
      body: JSON.stringify(payload),
    };
    if (tokensProvider?.get()) {
      return authRequest<EnquiryListItem>("/admissions/enquiries/", init);
    }
    return request<EnquiryListItem>("/admissions/enquiries/", init);
  },
  submitCounselling: (payload: CounsellingRequestInput) =>
    request<CounsellingRequestResult>("/admissions/counselling-requests/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  list: () => authRequest<PaginatedResponse<EnquiryListItem>>("/admissions/enquiries/"),
};

// ---------- Reviews & Ratings ----------
export type ReviewStatus = "PENDING" | "PUBLISHED" | "REJECTED";

export type ReviewListItem = {
  review_id: string;
  school_id: string;
  school_name: string;
  school_slug: string;
  user: number | null;
  author_name: string;
  rating: number;
  academics_rating: number | null;
  facilities_rating: number | null;
  safety_rating: number | null;
  communication_rating: number | null;
  title: string;
  body: string;
  status: ReviewStatus;
  is_verified: boolean;
  created_at: string;
};

export type SchoolRatingSummary = {
  school_id: string;
  school_name: string;
  average_rating: number | null;
  review_count: number;
  distribution: Record<string, number>;
  category_ratings: Record<
    "academics_rating" | "facilities_rating" | "safety_rating" | "communication_rating",
    { average: number | null; count: number }
  >;
};

export type ReviewInput = {
  school: string;
  rating: number;
  academics_rating?: number;
  facilities_rating?: number;
  safety_rating?: number;
  communication_rating?: number;
  title?: string;
  body?: string;
  author_name?: string;
};

export const reviews = {
  /** Published reviews for a school (public). */
  forSchool: (schoolId: string) =>
    request<PaginatedResponse<ReviewListItem>>(
      `/reviews/?school=${encodeURIComponent(schoolId)}&ordering=-created_at`,
    ),
  /** Most recent published reviews across the whole directory (public). */
  latest: () =>
    request<PaginatedResponse<ReviewListItem>>("/reviews/?ordering=-created_at"),
  /** Aggregate rating for a school (public). */
  summary: (schoolId: string) =>
    request<SchoolRatingSummary>(
      `/reviews/summary/?school=${encodeURIComponent(schoolId)}`,
    ),
  /** Submit a review. Requires authentication. */
  create: (payload: ReviewInput) =>
    authRequest<ReviewListItem>("/reviews/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export function schoolDetailToListItem(school: SchoolDetail): SchoolListItem {
  return {
    school_id: school.school_id,
    school_code: school.school_code,
    school_name: school.school_name,
    short_name: school.short_name,
    school_logo_url: school.school_logo_url,
    school_image_url: school.school_image_url,
    school_photos: school.photos_detail.slice(0, 3),
    videos_count: school.videos_detail.length,
    slug: school.slug,
    country_id: school.country_detail.country_id,
    country_name: school.country_detail.country_name,
    state_id: school.state_detail.state_id,
    state_name: school.state_detail.state_name,
    city_id: school.city_detail.city_id,
    city_name: school.city_detail.city_name,
    country_slug: school.country_detail.slug,
    state_slug: school.state_detail.slug,
    city_slug: school.city_detail.slug,
    location_id: school.location_detail?.location_id ?? null,
    location_name: school.location_detail?.location_name ?? null,
    location_slug: school.location_detail?.slug ?? null,
    boards_detail: school.boards_detail,
    school_types_detail: school.school_types_detail,
    board_id: school.board_detail?.board_id ?? null,
    board_name: school.board_detail?.board_name ?? null,
    school_type_id: school.school_type_detail?.school_type_id ?? null,
    school_type_name: school.school_type_detail?.type_name ?? null,
    gender: school.gender,
    verification_status: school.verification_status,
    pincode: school.pincode,
    address: school.address,
    lat: school.lat,
    lng: school.lng,
    phone: school.phone,
    email: school.email,
    principal_name: school.principal_name,
    established_year: school.established_year,
    annual_fee: null,
    average_rating: null,
    review_count: 0,
    grades_range: null,
    boarding_required: school.boarding_required,
    is_featured: school.is_featured,
    status: school.status,
    published_at: school.published_at,
  };
}

// ---------- School self-registration & verification ----------

export type SchoolRegistrationInput = {
  school_name: string;
  city: string;
  address: string;
  pincode?: string;
  school_phone?: string;
  school_email?: string;
  established_year?: number | null;
  gender?: "COED" | "BOYS" | "GIRLS";
  boards?: string[];
  school_types?: string[];
  contact_full_name: string;
  designation?: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
};

export type SchoolRegistrationResult = {
  school_id: string;
  school_code: string;
  school_name: string;
  verification_status: string;
  detail: string;
};

export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED";

export async function registerSchool(
  payload: SchoolRegistrationInput,
): Promise<SchoolRegistrationResult> {
  return request<SchoolRegistrationResult>("/schools/schools/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Pending-verification schools, for the admin review queue. */
export async function fetchVerificationQueue(): Promise<PaginatedResponse<SchoolListItem>> {
  return authRequest<PaginatedResponse<SchoolListItem>>(
    "/schools/schools/verification-queue/",
  );
}

export async function setSchoolVerification(
  schoolId: string,
  status: VerificationStatus,
  note: string,
): Promise<{ school_id: string; verification_status: string; event_id: string }> {
  return authRequest<{ school_id: string; verification_status: string; event_id: string }>(
    `/schools/schools/${schoolId}/verification/`,
    { method: "POST", body: JSON.stringify({ status, note }) },
  );
}

// ---------- Role dashboards ----------

export type DashboardEnquiry = {
  enquiry_id: string;
  enquiry_code: string;
  status: EnquiryStatus;
  priority: EnquiryPriority;
  created_at: string;
  school_name: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  child_name: string;
  message: string;
};

export type PendingSchool = {
  school_id: string;
  school_name: string;
  school_code: string;
  city_name: string;
  state_name: string;
  created_at: string;
};

export type SchoolDashboardData = {
  panel_access: "admin" | "pending";
  school: {
    school_id: string;
    school_name: string;
    school_code: string;
    slug: string;
    verification_status: VerificationStatus;
    status: boolean;
    city_name: string;
    state_name: string;
    country_slug: string;
    state_slug: string;
    city_slug: string;
    location_slug: string | null;
    school_types_detail: SchoolTypeListItem[];
    profile_completeness: number;
    profile_gaps: string[];
  };
  stats: {
    enquiries_total: number;
    enquiries_new: number;
    enquiries_this_month: number;
    enquiries_converted: number;
    reviews_published: number;
    reviews_pending: number;
    average_rating: number | null;
  };
  enquiry_status: Record<string, number>;
  recent_enquiries: DashboardEnquiry[];
};

export type SchoolPortalData = {
  school_id: string;
  school_name: string;
  school_code: string;
  short_name: string;
  tagline: string;
  about: string;
  website: string;
  phone: string;
  email: string;
  principal_name: string;
  address: string;
  pincode: string;
  established_year: number | null;
  school_logo_url: string;
  school_image_url: string;
  admission_open: boolean;
  verification_status: VerificationStatus;
};

export type SchoolPortalUpdate = Pick<
  SchoolPortalData,
  | "short_name"
  | "tagline"
  | "about"
  | "website"
  | "phone"
  | "email"
  | "principal_name"
  | "address"
  | "pincode"
  | "established_year"
  | "school_logo_url"
  | "school_image_url"
  | "admission_open"
>;

export type ParentDashboardData = {
  stats: {
    enquiries_total: number;
    enquiries_open: number;
    children: number;
    reviews_total: number;
    reviews_published: number;
    shortlisted: number;
  };
  shortlist: {
    shortlist_id: string;
    note: string;
    created_at: string;
    school_id: string;
    school_name: string;
    slug: string;
    verification_status: VerificationStatus;
    city_name: string;
    state_name: string;
    country_slug: string;
    state_slug: string;
    city_slug: string;
    location_slug: string | null;
    school_types_detail: SchoolTypeListItem[];
  }[];
  children: {
    child_id: string;
    name: string;
    date_of_birth: string;
    gender: string;
  }[];
  recent_enquiries: DashboardEnquiry[];
};

export type AdminDashboardData = {
  schools: {
    total: number;
    listed: number;
    pending_verification: number;
    verified: number;
    added_this_month: number;
  };
  users: {
    total: number;
    parents: number;
    school_admins: number;
    staff_admins: number;
    super_admins: number;
    new_this_month: number;
  };
  enquiries: {
    total: number;
    this_month: number;
    by_status: Record<string, number>;
  };
  reviews: { total: number; by_status: Record<string, number> };
  counselling: { total: number; new: number };
  coverage: { cities_covered: number };
  pending_schools: PendingSchool[];
  recent_enquiries: DashboardEnquiry[];
};

export type StaffAdminDashboardData = {
  queues: {
    reviews_pending: number;
    schools_pending: number;
    enquiries_new: number;
    enquiries_unassigned: number;
    counselling_new: number;
  };
  workload: {
    enquiries_this_month: number;
    reviews_this_month: number;
    counselling_this_month: number;
  };
  recent_reviews: {
    review_id: string;
    school_name: string;
    rating: number;
    status: ReviewStatus;
    author_name: string;
    title: string;
    created_at: string;
  }[];
  recent_enquiries: DashboardEnquiry[];
  pending_schools: PendingSchool[];
};

export const dashboards = {
  school: () => authRequest<SchoolDashboardData>("/dashboards/school/"),
  updateEnquiryStatus: (enquiryId: string, status: EnquiryStatus) =>
    authRequest<DashboardEnquiry>(`/dashboards/school/enquiries/${enquiryId}/status/`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  parent: () => authRequest<ParentDashboardData>("/dashboards/parent/"),
  shortlistStatus: (schoolId: string) =>
    authRequest<{ saved: boolean }>(`/dashboards/parent/shortlist/?school_id=${encodeURIComponent(schoolId)}`),
  saveShortlist: (schoolId: string) =>
    authRequest<{ saved: boolean; shortlist_id?: string }>("/dashboards/parent/shortlist/", {
      method: "POST",
      body: JSON.stringify({ school_id: schoolId }),
    }),
  removeShortlist: (schoolId: string) =>
    authRequest<{ saved: boolean }>("/dashboards/parent/shortlist/", {
      method: "DELETE",
      body: JSON.stringify({ school_id: schoolId }),
    }),
  admin: () => authRequest<AdminDashboardData>("/dashboards/admin/"),
  staffAdmin: () =>
    authRequest<StaffAdminDashboardData>("/dashboards/staff-admin/"),
};
