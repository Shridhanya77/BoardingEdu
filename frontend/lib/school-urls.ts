import {
  homeSchoolCategoryPath,
  schoolProfilePathFromSlugs,
  toSeoSlug,
  withTrailingSlash,
  type HomeSchoolCategory,
  type SchoolTypeCategory,
} from "@/lib/seo-slugs";

export type SchoolPathFields = {
  country_slug: string;
  state_slug: string;
  city_slug: string;
  location_slug?: string | null;
  slug: string;
};

export function schoolListPath(school: SchoolPathFields): string {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
  });
}

export function boardListingPath(
  slug: string,
  category?: HomeSchoolCategory | null,
): string {
  const path = withTrailingSlash(`/board/${toSeoSlug(slug)}`);
  return category
    ? `${path}?home_category=${homeSchoolCategoryPath(category)}`
    : path;
}

export function placeListingPath(parts: {
  countrySlug: string;
  stateSlug?: string | null;
  citySlug?: string | null;
  locationSlug?: string | null;
  category?: HomeSchoolCategory | null;
}): string {
  const path = `/${[
    parts.countrySlug,
    parts.stateSlug,
    parts.citySlug,
    parts.locationSlug,
  ]
    .filter((slug): slug is string => Boolean(slug))
    .map(toSeoSlug)
    .join("/")}`;
  const categoryPath = parts.category
    ? `${path}/${homeSchoolCategoryPath(parts.category)}`
    : path;
  return withTrailingSlash(categoryPath);
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
