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

export function schoolProfilePathFromSlugs({
  countrySlug,
  stateSlug,
  citySlug,
  localitySlug,
  schoolSlug,
}: {
  countrySlug: string;
  stateSlug: string;
  citySlug: string;
  localitySlug?: string | null;
  schoolSlug: string;
}) {
  return `/${[countrySlug, stateSlug, citySlug, localitySlug, schoolSlug]
    .filter((slug): slug is string => Boolean(slug))
    .map(toSeoSlug)
    .join("/")}`;
}

export type SchoolTypeCategory = "day-school" | "day-boarding-school" | "boarding-school";
export type HomeSchoolCategory = "day-school" | "residential-school";

export function homeSchoolCategory(typeCode: string, slug = "", name = ""): HomeSchoolCategory | null {
  const value = `${typeCode} ${slug} ${name}`.toLowerCase().replace(/_/g, "-");
  if (/\bboarding\b/.test(value)) return "residential-school";
  if (/\bday\b|day-school/.test(value)) return "day-school";
  return null;
}

export function homeSchoolTypeIds(
  types: { school_type_id: string; type_code: string; slug: string; type_name: string }[],
  category: HomeSchoolCategory,
) {
  return types
    .filter((type) => homeSchoolCategory(type.type_code, type.slug, type.type_name) === category)
    .map((type) => type.school_type_id);
}

export function homeSchoolCategoryForIds(
  typeIds: string[],
  types: { school_type_id: string; type_code: string; slug: string; type_name: string }[],
): HomeSchoolCategory | null {
  const categories = typeIds.map((id) => {
    const type = types.find((item) => item.school_type_id === id);
    return type ? homeSchoolCategory(type.type_code, type.slug, type.type_name) : null;
  });
  if (!categories.length || categories.some((category) => !category || category !== categories[0])) return null;
  return categories[0];
}

export function schoolTypeCategory(typeCode: string, slug = "", name = ""): SchoolTypeCategory | null {
  const value = `${typeCode} ${slug} ${name}`.toLowerCase().replace(/_/g, "-");
  if (/day[- ]boarding/.test(value)) return "day-boarding-school";
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

export function schoolProfileTypeSegment(types: { type_code: string; slug: string; type_name: string }[]) {
  const categories = types.map((type) => schoolTypeCategory(type.type_code, type.slug, type.type_name));
  if (categories.includes("boarding-school")) return "boarding";
  return "dayschool";
}

export function isDiscoverableSchoolType(typeCode: string, slug = "", name = "") {
  return schoolTypeCategory(typeCode, slug, name) !== null;
}
