import {
  schoolProfilePathFromSlugs,
  toSeoSlug,
  withTrailingSlash,
  type HomeSchoolCategory,
  type SchoolTypeCategory,
} from "@/lib/seo-slugs";
import { indiaRegionById, type IndiaRegionId } from "@/lib/india-regions";

export type SchoolPathFields = {
  country_slug: string;
  state_slug: string;
  city_slug: string;
  location_slug?: string | null;
  slug: string;
  school_types_detail: { type_code: string; slug: string; type_name: string }[];
};

export function schoolListPath(school: SchoolPathFields & { school_name?: string }): string {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
    schoolName: school.school_name,
    schoolTypes: school.school_types_detail,
  });
}

export function schoolEnquiryPath(school: SchoolPathFields): string {
  return `${schoolListPath(school)}enquiry/`;
}

/**
 * Day/boarding selection is the final path segment (`day-schools` or
 * `boarding-schools`), never a query string. Direct links, refresh, and
 * back/forward all keep the selection in the path so every filtered listing
 * has one indexable, query-free canonical URL.
 */
export function listingCategorySegment(category?: HomeSchoolCategory | null): "day-schools" | "boarding-schools" | null {
  if (!category) return null;
  return category === "day-school" ? "day-schools" : "boarding-schools";
}

export function withCategorySegment(path: string, category?: HomeSchoolCategory | null): string {
  const url = new URL(path, "https://boardingeu.invalid");
  url.searchParams.delete("school_type");
  url.searchParams.delete("home_category");
  url.searchParams.delete("type");
  url.searchParams.delete("category");
  const base = withTrailingSlash(url.pathname);
  const segment = listingCategorySegment(category);
  const typedPath = segment ? `${base}${segment}/` : base;
  const query = url.searchParams.toString();
  return query ? `${typedPath}?${query}` : typedPath;
}

/**
 * Board listing URL. School type is the trailing path segment:
 *   /board/cbse/                  → all CBSE schools
 *   /board/cbse/day-schools/      → day + day boarding schools
 *   /board/cbse/boarding-schools/ → boarding + day boarding schools
 */
export function boardListingPath(
  slug: string,
  category?: HomeSchoolCategory | null,
): string {
  return withCategorySegment(`/board/${toSeoSlug(slug)}`, category);
}

/** Directory URL. Day/boarding selection is the trailing path segment. */
export function schoolDirectoryPath(category?: HomeSchoolCategory | null): string {
  return withCategorySegment("/schools", category);
}

export function indiaRegionListingPath(
  regionId: IndiaRegionId,
  category?: HomeSchoolCategory | null,
): string {
  const region = indiaRegionById(regionId);
  if (!region) throw new Error(`Unknown Indian region: ${regionId}`);
  return withCategorySegment(`/india/${region.slug}`, category);
}

export function indiaRegionBoardListingPath(
  regionId: IndiaRegionId,
  boardSlugs: string[],
  category?: HomeSchoolCategory | null,
): string {
  const region = indiaRegionById(regionId);
  if (!region) throw new Error(`Unknown Indian region: ${regionId}`);
  if (!boardSlugs.length) throw new Error("At least one board is required.");
  return withCategorySegment(
    `/india/${region.slug}/board/${boardSlugs.map(toSeoSlug).join(",")}`,
    category,
  );
}

export function schoolSearchPath(query: string): string {
  const slug = toSeoSlug(query.replace(/[?#]/g, " "));
  return slug ? withTrailingSlash(`/schools/search/${slug}`) : schoolDirectoryPath();
}

/**
 * Geographical listing URL. School type is the trailing path segment.
 *   /india/
 *   /india/maharashtra/
 *   /india/maharashtra/panchgani/
 *   /india/maharashtra/pune/kothrud/
 *   /india/maharashtra/boarding-schools/
 */
export function placeListingPath(parts: {
  countrySlug: string;
  stateSlug?: string | null;
  citySlug?: string | null;
  locationSlug?: string | null;
  category?: HomeSchoolCategory | null;
}): string {
  const slugs = [
    parts.countrySlug,
    parts.stateSlug,
    parts.citySlug,
    parts.locationSlug,
  ].filter((slug): slug is string => Boolean(slug)).map(toSeoSlug);
  return withCategorySegment(`/${slugs.join("/")}`, parts.category);
}

/**
 * Keyword-rich
 * Examples: /schools-in-mumbai, /boarding-schools-in-mumbai,
 * /cbse-boarding-schools-in-mumbai, /day-schools-in-pune-with-low-fees
 */
export const LISTING_INFIX = "-schools-in-";
export const LISTING_ALL_PREFIX = "schools-in-";
export const LOW_FEES_SUFFIX = "-with-low-fees";

/** URL token used for each canonical school-type category. */
const TYPE_TOKEN: Record<SchoolTypeCategory, string> = {
  "day-school": "day",
  "day-boarding-school": "day-boarding",
  "boarding-school": "boarding",
};

/** Type tokens in priority order — "day-boarding" must be tested before "boarding". */
const TYPE_TOKENS: [string, SchoolTypeCategory][] = [
  ["day-boarding", "day-boarding-school"],
  ["boarding", "boarding-school"],
  ["residential", "boarding-school"],
  ["day", "day-school"],
];

export type ListingSpec = {
  type: SchoolTypeCategory | null;
  boardSlug: string | null;
  placeSlug: string | null;
  lowFees: boolean;
};

export function listingPath(options: {
  type?: SchoolTypeCategory | null;
  boardSlug?: string | null;
  placeSlug?: string | null;
  lowFees?: boolean;
}): string {
  const prefix = [options.boardSlug, options.type ? TYPE_TOKEN[options.type] : null]
    .filter((token): token is string => Boolean(token))
    .map(toSeoSlug)
    .join("-");
  const base = prefix ? `/${prefix}${LISTING_INFIX}` : `/${LISTING_ALL_PREFIX}`;
  const place = options.placeSlug ? toSeoSlug(options.placeSlug) : "";
  return `${base}${place}${options.lowFees ? LOW_FEES_SUFFIX : ""}`;
}

/** True when a single path segment looks like a keyword listing slug. */
export function isListingSlug(segment: string): boolean {
  const value = toSeoSlug(segment);
  return value === "schools" || value.includes(LISTING_ALL_PREFIX) || value.includes(LISTING_INFIX);
}

export function parseListingPath(
  segment: string,
  boardSlugs: string[],
): ListingSpec | null {
  let value = toSeoSlug(segment);
  let lowFees = false;
  if (value.endsWith(LOW_FEES_SUFFIX)) {
    lowFees = true;
    value = value.slice(0, -LOW_FEES_SUFFIX.length);
  }

  const infixIndex = value.lastIndexOf(LISTING_INFIX);
  const allIndex = value.lastIndexOf(LISTING_ALL_PREFIX);
  let qualifier: string;
  let placeSlug: string;
  if (infixIndex !== -1) {
    qualifier = value.slice(0, infixIndex);
    placeSlug = value.slice(infixIndex + LISTING_INFIX.length);
  } else if (allIndex !== -1) {
    qualifier = value.slice(0, allIndex);
    placeSlug = value.slice(allIndex + LISTING_ALL_PREFIX.length);
  } else {
    return null;
  }
  if (!placeSlug) return null;

  let rest = qualifier;
  let type: SchoolTypeCategory | null = null;
  for (const [token, category] of TYPE_TOKENS) {
    if (rest === token || rest.endsWith(`-${token}`)) {
      type = category;
      rest = rest.slice(0, rest.length - token.length).replace(/-$/, "");
      break;
    }
  }

  const knownBoard = boardSlugs.find((slug) => toSeoSlug(slug) === rest);
  const boardSlug = rest ? knownBoard ?? rest : null;
  return { type, boardSlug, placeSlug, lowFees };
}
