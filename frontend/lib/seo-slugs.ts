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

export function isDiscoverableSchoolType(typeCode: string, slug = "", name = "") {
  return typeCode.toUpperCase() === "DAY" || slug === "day-school" ||
    /^(FULL-BOARDING|BOARDING|RESIDENTIAL)$/i.test(typeCode) ||
    /^(full-boarding|residential-school|boarding-school)$/i.test(slug) ||
    /full boarding|residential school/i.test(name);
}
