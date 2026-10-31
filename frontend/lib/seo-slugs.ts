/** Normalize labels consistently for canonical discovery and school URLs. */
export function toSeoSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function withTrailingSlash(path: string): string {
  const url = new URL(path, "https://boardingeu.invalid");
  const lastSegment = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  if (!url.pathname.endsWith("/") && !lastSegment.includes(".")) {
    url.pathname = `${url.pathname}/`;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function schoolSlugFromName(name: string): string {
  return toSeoSlug(name);
}

export function canonicalSchoolSlug(slug: string, schoolName = ""): string {
  const cleaned = toSeoSlug(slug);
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug.trim());
  if (!cleaned || uuidLike) return schoolSlugFromName(schoolName) || cleaned;
  return cleaned;
}

export function schoolProfilePathFromSlugs({
  countrySlug,
  stateSlug,
  citySlug,
  localitySlug,
  schoolSlug,
  schoolName,
}: {
  countrySlug: string;
  stateSlug: string;
  citySlug: string;
  localitySlug?: string | null;
  schoolSlug: string;
  schoolName?: string;
}) {
  return withTrailingSlash(`/${[
    canonicalSchoolSlug(schoolSlug, schoolName),
    localitySlug,
    citySlug,
    stateSlug,
    countrySlug,
  ]
    .filter((slug): slug is string => Boolean(slug))
    .map(toSeoSlug)
    .join("/")}`);
}

export type SchoolTypeCategory = "day-school" | "day-boarding-school" | "boarding-school";
export type HomeSchoolCategory = "day-school" | "residential-school";

export function homeSchoolCategoryFromValue(value?: string | null): HomeSchoolCategory | null {
  if (value === "day-school") return "day-school";
  if (value === "boarding-school" || value === "boarding-schools" || value === "residential-school") return "residential-school";
  return null;
}

/**
 * Query value used by the `?home_category=` API filter. The backend accepts
 * `day-school` and `boarding-schools` (plus `residential-school`).
 */
export function homeSchoolCategoryPath(category: HomeSchoolCategory): "day-school" | "boarding-schools" {
  return category === "day-school" ? "day-school" : "boarding-schools";
}

/**
 * Final path segment of a typed listing URL, e.g. /india/karnataka/boarding-school/.
 * Day Boarding belongs to both families, so only the two parent types get a segment.
 */
export function schoolCategorySegment(category: HomeSchoolCategory): "day-school" | "boarding-school" {
  return category === "day-school" ? "day-school" : "boarding-school";
}

export function homeSchoolCategories(typeCode: string, slug = "", name = ""): HomeSchoolCategory[] {
  const type = schoolTypeCategory(typeCode, slug, name);
  if (type === "day-boarding-school") return ["day-school", "residential-school"];
  if (type === "day-school") return ["day-school"];
  if (type === "boarding-school") return ["residential-school"];
  return [];
}

export function homeSchoolCategory(typeCode: string, slug = "", name = ""): HomeSchoolCategory | null {
  return homeSchoolCategories(typeCode, slug, name)[0] ?? null;
}

export function homeSchoolTypeIds(
  types: { school_type_id: string; type_code: string; slug: string; type_name: string }[],
  category: HomeSchoolCategory,
) {
  return types
    .filter((type) => homeSchoolCategories(type.type_code, type.slug, type.type_name).includes(category))
    .map((type) => type.school_type_id);
}

export function homeSchoolCategoryForIds(
  typeIds: string[],
  types: { school_type_id: string; type_code: string; slug: string; type_name: string }[],
): HomeSchoolCategory | null {
  const selectedTypes = typeIds
    .map((id) => types.find((item) => item.school_type_id === id))
    .filter((type): type is (typeof types)[number] => Boolean(type));
  if (!selectedTypes.length || selectedTypes.length !== typeIds.length) return null;

  const containsDayOnlyType = selectedTypes.some((type) =>
    schoolTypeCategory(type.type_code, type.slug, type.type_name) === "day-school",
  );
  const containsBoardingOnlyType = selectedTypes.some((type) =>
    schoolTypeCategory(type.type_code, type.slug, type.type_name) === "boarding-school",
  );
  if (containsDayOnlyType && !containsBoardingOnlyType) return "day-school";
  if (containsBoardingOnlyType) return "residential-school";
  return homeSchoolCategories(
    selectedTypes[0].type_code,
    selectedTypes[0].slug,
    selectedTypes[0].type_name,
  )[0] ?? null;
}

export function schoolTypeCategory(typeCode: string, slug = "", name = ""): SchoolTypeCategory | null {
  const value = `${typeCode} ${slug} ${name}`.toLowerCase().replace(/_/g, "-");
  if (/day[- ]boarding|day\s*cum|day-cum|daycum/.test(value)) return "day-boarding-school";
  if (/^(boarding|residential)(\s|$)|\bboarding-school\b|\bresidential-school\b/.test(value)) return "boarding-school";
  if (/full[- ]boarding/.test(value)) return "boarding-school";
  if (/\bday\b|day-school/.test(value)) return "day-school";
  return null;
}

export function schoolTypeLabel(typeCode: string, slug = "", name = "") {
  const category = schoolTypeCategory(typeCode, slug, name);
  return category === "day-school" ? "Day School"
    : category === "boarding-school" ? "Boarding School"
      : category === "day-boarding-school" ? "Day Boarding School" : name;
}

export const schoolTypePath = (typeCode: string, slug = "", name = "") =>
  schoolTypeCategory(typeCode, slug, name) === "day-school" ? "day-school" : "residential-school";

export function isDiscoverableSchoolType(typeCode: string, slug = "", name = "") {
  return schoolTypeCategory(typeCode, slug, name) !== null;
}
