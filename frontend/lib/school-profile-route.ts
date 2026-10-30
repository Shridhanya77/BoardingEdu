import type { SchoolDetail } from "@/lib/api";
import { schoolSlugFromName, toSeoSlug } from "@/lib/seo-slugs";

/** Root country segment at the end of school-first profile URLs. */
const ROOT_COUNTRY_SLUGS = new Set(["india"]);

/**
 * Canonical school profile paths:
 * - School-first: /{school}/{city}/{state}/{country}/ or /{school}/{locality}/{city}/{state}/{country}/
 * - Legacy place-first: /{country}/{state}/{city}/{school}/ (optional locality as 5th before school in old links)
 */
export function profileSegmentsWithoutTypeSuffix(segments: string[]): string[] {
  const last = segments[segments.length - 1]?.toLowerCase();
  if (segments.length === 6 && (last === "boarding-school" || last === "day-school")) {
    return segments.slice(0, 5);
  }
  return segments;
}

export function schoolSlugFromProfileSegments(segments: string[]): string | null {
  const normalized = profileSegmentsWithoutTypeSuffix(segments);
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

/** Geographic tail of a school-first profile URL (not legacy place-first). */
export function schoolFirstProfileGeo(segments: string[]) {
  const normalized = profileSegmentsWithoutTypeSuffix(segments);
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
  if (toSeoSlug(school.city_detail.slug) !== geo.citySlug) return false;

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
