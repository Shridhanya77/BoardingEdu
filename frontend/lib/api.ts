// Central BoardingEdu DRF API client — single source of truth
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000/api").replace(/\/$/, "");
const API_ORIGIN = new URL(API_BASE).origin;

const defaultHeaders = { "Content-Type": "application/json" };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
    const detail = await res.text();
    throw new ApiError(res.status, `API ${res.status} on ${path}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Auth (JWT, SimpleJWT w/ rotation enabled on BE) ----------
export const auth = {
  obtain: (username: string, password: string) =>
    request<{ access: string; refresh: string }>("/auth/jwt/token/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  refresh: (refreshToken: string) =>
    request<{ access: string }>("/auth/jwt/token/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
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
  location_id: string | null; location_name: string | null;
  board_id: string;   board_name: string;
  school_type_id: string; school_type_name: string;
  gender: string;                              // "Co-Ed" etc (display, NOT raw enum)
  verification_status: string;                 // "Verified" etc
  pincode: string | null; address: string | null;
  lat: number | null; lng: number | null;
  phone: string | null; email: string | null;
  principal_name: string | null;
  established_year: number | null;
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
  school_type?: string;
  gender?: "COED" | "BOYS" | "GIRLS";
  ordering?: "school_name" | "-school_name" | "established_year" | "-established_year";
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
export type SchoolDetail = Omit<
  SchoolListItem,
  | "country_id" | "country_name" | "state_id" | "state_name"
  | "city_id" | "city_name" | "location_id" | "location_name"
  | "board_id" | "board_name" | "school_type_id" | "school_type_name"
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
  board: string;
  board_detail: BoardListItem;
  school_type: string;
  school_type_detail: SchoolTypeListItem;
  gender: "COED" | "BOYS" | "GIRLS";
  verification_status: "UNVERIFIED" | "PENDING" | "VERIFIED";
  created_at: string;
  updated_at: string;
};

export const schools = {
  list: (filters: SchoolFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const query = params.toString();
    return request<PaginatedResponse<SchoolListItem>>(
      `/schools/schools/${query ? `?${query}` : ""}`,
    );
  },
  page: (url: string) => request<PaginatedResponse<SchoolListItem>>(url),
  types: () => request<PaginatedResponse<SchoolTypeListItem>>("/schools/school-types/"),
  retrieve: (uuid: string) => request<SchoolDetail>(`/schools/schools/${uuid}/`),
  bySlug: async (slug: string) => {
    const response = await schools.list({ search: slug });
    const match = response.results.find((school) => school.slug === slug);
    if (!match) throw new ApiError(404, `School "${slug}" was not found.`);
    return schools.retrieve(match.school_id);
  },
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
};