import { schoolProfilePathFromSlugs, toSeoSlug } from "@/lib/seo-slugs";

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

export function placeListingPath(parts: {
  countrySlug: string;
  stateSlug?: string | null;
  citySlug?: string | null;
  locationSlug?: string | null;
  category?: "day-school" | "residential-school" | null;
}): string {
  const slugs = [
    parts.countrySlug,
    parts.stateSlug,
    parts.citySlug,
    parts.locationSlug,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => toSeoSlug(value));
  const base = `/${slugs.join("/")}`;
  return parts.category ? `${base}/${parts.category}` : base;
}

export function boardListingPath(slug: string): string {
  return `/board/${toSeoSlug(slug)}`;
}
