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

export const schoolTypePath = (typeCode: string) =>
  typeCode.toUpperCase() === "DAY" ? "day-school" : "residential-school";

export type SchoolTypeCategory = "day-school" | "boarding-school" | "full-boarding-school";

export function schoolTypeCategory(typeCode: string, slug = "", name = ""): SchoolTypeCategory | null {
  const value = `${typeCode} ${slug} ${name}`.toLowerCase().replace(/_/g, "-");
  if (/full[- ]boarding/.test(value)) return "full-boarding-school";
  if (/^(boarding|residential)(\s|$)|\bboarding-school\b|\bresidential-school\b/.test(value)) return "boarding-school";
  // Day Boarding students return home nightly, so it belongs in the Day School search.
  if (/\bday\b|day-school|day-boarding/.test(value)) return "day-school";
  return null;
}

export function schoolTypeLabel(typeCode: string, slug = "", name = "") {
  const category = schoolTypeCategory(typeCode, slug, name);
  return category === "day-school" ? "Day School"
    : category === "boarding-school" ? "Boarding School"
      : category === "full-boarding-school" ? "Full Boarding School" : name;
}

export function isDiscoverableSchoolType(typeCode: string, slug = "", name = "") {
  return schoolTypeCategory(typeCode, slug, name) !== null;
}
