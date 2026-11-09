import type { SchoolDetail } from "@/lib/api";
import { schoolSlugFromName, toSeoSlug } from "@/lib/seo-slugs";

/** Root country segment used by legacy school-first profile URLs. */
const ROOT_COUNTRY_SLUGS = new Set(["india"]);
type ProfileCategory = "boarding-schools" | "day-schools";

function profileCategory(segments: string[]): ProfileCategory | null {
  const first = toSeoSlug(segments[0] ?? "");
  if (first === "boarding-schools") return "boarding-schools";
  if (first === "day-schools") return "day-schools";
  return null;
}

/**
 * Canonical school profile path: /{country}/{state}/{city}/{school}/ — the
 * school type is never a path segment, so day and boarding schools share one
 * shape. Legacy typed forms are still parsed so they can redirect:
 * - /boarding-schools/{country}/{state}/{school}/
 * - /day-schools/{country}/{state}/{city}/{school}/
 * - Legacy school-first: /{school}/{city}/{state}/{country}/ or /{school}/{locality}/{city}/{state}/{country}/
 */
export function profileSegmentsWithoutTypeSuffix(segments: string[]): string[] {
  const last = segments[segments.length - 1]?.toLowerCase().replace(/_/g, "-");
  if (
    segments.length === 6 &&
    ["boarding-school", "boarding-schools", "day-school", "day-schools"].includes(last ?? "")
  ) {
    return segments.slice(0, 5);
  }
  return segments;
}

export function schoolSlugFromProfileSegments(segments: string[]): string | null {
  const normalized = profileSegmentsWithoutTypeSuffix(segments);
  const category = profileCategory(normalized);
  if (
    (category === "boarding-schools" && normalized.length === 4) ||
    (category === "day-schools" && normalized.length === 5)
  ) {
    return toSeoSlug(normalized[normalized.length - 1] ?? "") || null;
  }
  if (normalized.length !== 4 && normalized.length !== 5) return null;

  const first = toSeoSlug(normalized[0] ?? "");
  const last = toSeoSlug(normalized[normalized.length - 1] ?? "");

  if (ROOT_COUNTRY_SLUGS.has(last) && !ROOT_COUNTRY_SLUGS.has(first)) {
    return first || null;
  }
  if (ROOT_COUNTRY_SLUGS.has(first) && !ROOT_COUNTRY_SLUGS.has(last)) {
    return last || null;
  }
  return null;
}

export function isSchoolProfileSegmentPath(segments: string[]): boolean {
  return schoolSlugFromProfileSegments(segments) !== null;
}

/** Geography encoded in a profile URL, or null for place-first legacy URLs. */
export function schoolFirstProfileGeo(segments: string[]) {
  const normalized = profileSegmentsWithoutTypeSuffix(segments);
  const category = profileCategory(normalized);
  if (category === "boarding-schools" && normalized.length === 4) {
    return {
      localitySlug: null as string | null,
      citySlug: null as string | null,
      stateSlug: toSeoSlug(normalized[2] ?? ""),
      countrySlug: toSeoSlug(normalized[1] ?? ""),
    };
  }
  if (category === "day-schools" && normalized.length === 5) {
    return {
      localitySlug: null as string | null,
      citySlug: toSeoSlug(normalized[3] ?? ""),
      stateSlug: toSeoSlug(normalized[2] ?? ""),
      countrySlug: toSeoSlug(normalized[1] ?? ""),
    };
  }
  if (normalized.length !== 4 && normalized.length !== 5) return null;
  const first = toSeoSlug(normalized[0] ?? "");
  const last = toSeoSlug(normalized[normalized.length - 1] ?? "");
  if (!ROOT_COUNTRY_SLUGS.has(last) || ROOT_COUNTRY_SLUGS.has(first)) return null;

  if (normalized.length === 5) {
    return {
      localitySlug: toSeoSlug(normalized[1] ?? ""),
      citySlug: toSeoSlug(normalized[2] ?? ""),
      stateSlug: toSeoSlug(normalized[3] ?? ""),
      countrySlug: toSeoSlug(normalized[4] ?? ""),
    };
  }
  return {
    localitySlug: null as string | null,
    citySlug: toSeoSlug(normalized[1] ?? ""),
    stateSlug: toSeoSlug(normalized[2] ?? ""),
    countrySlug: toSeoSlug(normalized[3] ?? ""),
  };
}

export function schoolGeographyMatchesProfilePath(
  school: SchoolDetail,
  segments: string[],
): boolean {
  const geo = schoolFirstProfileGeo(segments);
  if (!geo) return true;

  if (toSeoSlug(school.country_detail.slug) !== geo.countrySlug) return false;
  if (toSeoSlug(school.state_detail.slug) !== geo.stateSlug) return false;
  if (geo.citySlug && toSeoSlug(school.city_detail.slug) !== geo.citySlug) return false;

  if (geo.localitySlug) {
    const locationSlug = school.location_detail?.slug;
    if (!locationSlug || toSeoSlug(locationSlug) !== geo.localitySlug) return false;
  }
  return true;
}

export function schoolSlugMatchesProfilePath(school: SchoolDetail, segments: string[]): boolean {
  const slug = schoolSlugFromProfileSegments(segments);
  if (!slug) return false;
  const dbSlug = toSeoSlug(school.slug);
  const nameSlug = schoolSlugFromName(school.school_name);
  return slug === dbSlug || (nameSlug.length > 0 && slug === nameSlug);
}
