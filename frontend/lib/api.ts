// Central BoardingEdu DRF API client — single source of truth
const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;
if (!configuredApiBase && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_API_BASE must be set to the deployed API URL.");
}

export const API_BASE = (
  configuredApiBase ?? "https://boardingedu-mtjnrv7eo-shridhanya77s-projects.vercel.app"
).replace(/\/+$/, "");
const API_ORIGIN = new URL(API_BASE).origin;

const defaultHeaders = { "Content-Type": "application/json" };

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
  const url = path.startsWith("http") ? new URL(path) : new URL(`${API_BASE}${path}`);
  if (url.origin !== API_ORIGIN) {
    throw new Error("The API returned a pagination URL outside the configured API host.");
  }

  const res = await fetch(url, {
    ...init,
    headers: { ...defaultHeaders, ...init.headers },
    next: { revalidate: 60 }, // ISR: revalidate every 60s for school listing
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
  return (await res.json()) as Promise<T>;
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

  const url = path.startsWith("http") ? new URL(path) : new URL(`${API_BASE}${path}`);
  if (url.origin !== API_ORIGIN) {
    throw new Error("The API returned a pagination URL outside the configured API host.");
  }

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
  school_admin_profile: { school_id: string | null; school_code: string | null; school_name: string | null; designation: string } | null;
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
  slug: string;
  country_id: string; country_name: string;
  state_id: string;   state_name: string;
  city_id: string;    city_name: string;
  country_slug: string;
  state_slug: string;
  city_slug: string;
  location_id: string | null; location_name: string | null;
  boards_detail: BoardListItem[];
  school_types_detail: SchoolTypeListItem[];
  board_id: string | null; board_name: string | null;
  school_type_id: string | null; school_type_name: string | null;
  gender: string;                              // "Co-Ed" etc (display, NOT raw enum)
  verification_status: string;                 // "Verified" etc
  pincode: string | null; address: string | null;
  lat: number | null; lng: number | null;
  phone: string | null; email: string | null;
  principal_name: string | null;
  established_year: number | null;
  annual_fee: string | null;
  boarding_required: boolean;
  status: boolean;
  published_at: string | null;
};

export type PaginatedResponse<T> = { next: string | null; previous: string | null; results: T[] };
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
  city_code: string;
  city_name: string;
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
  board?: string | string[];
  min_fee?: number;
  max_fee?: number;
  gender?: "COED" | "BOYS" | "GIRLS";
  ordering?: "school_name" | "-school_name" | "established_year" | "-established_year" | "annual_fee" | "-annual_fee";
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

export async function fetchAllPages<T>(firstPage: PaginatedResponse<T>, maxPages = 20): Promise<T[]> {
  const items = [...firstPage.results];
  let next = firstPage.next;
  let pages = 1;
  while (next && pages < maxPages) {
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
  gender: "COED" | "BOYS" | "GIRLS";
  verification_status: "UNVERIFIED" | "PENDING" | "VERIFIED";
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
  retrieve: (uuid: string) => request<SchoolDetail>(`/schools/schools/${uuid}/`),
  /**
   * Direct slug lookup via the dedicated backend by-slug endpoint.
   * One DB hit, one HTTP round-trip (no more list+search+loop).
   * Returns the full SchoolDetail with nested facilities and grades.
   */
  bySlug: (slug: string) => request<SchoolDetail>(`/schools/schools/by-slug/${encodeURIComponent(slug)}/`),
};

// ---------- Geography (cascading dropdowns) ----------
export const geography = {
  countries: () => request<PaginatedResponse<CountryListItem>>("/geography/countries/"),
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
  list: () => authRequest<PaginatedResponse<EnquiryListItem>>("/admissions/enquiries/"),
};

export function schoolDetailToListItem(school: SchoolDetail): SchoolListItem {
  return {
    school_id: school.school_id,
    school_code: school.school_code,
    school_name: school.school_name,
    short_name: school.short_name,
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
    boarding_required: school.boarding_required,
    status: school.status,
    published_at: school.published_at,
  };
}