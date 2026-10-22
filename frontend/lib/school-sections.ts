import { withTrailingSlash } from "@/lib/seo-slugs";

/**
 * Single source of truth for the section navigation on a school profile page.
 * The `id` doubles as the URL segment appended after the school slug, so
 * `/india/uttarakhand/dehradun/krishna-nagar/the-doon-school/admissions/`
 * deep-links straight to the admissions panel.
 */
export const schoolSections = [
  { id: "overview", label: "Overview" },
  { id: "fees", label: "Fees" },
  { id: "admissions", label: "Admissions" },
  { id: "facilities", label: "Facilities" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "media", label: "Photos & Videos" },
  { id: "reviews", label: "Reviews" },
  { id: "location", label: "Location" },
] as const;

export type SchoolSectionId = (typeof schoolSections)[number]["id"];

const SCHOOL_SECTION_IDS = schoolSections.map((section) => section.id) as readonly string[];

export function isSchoolSectionId(value?: string | null): value is SchoolSectionId {
  return typeof value === "string" && SCHOOL_SECTION_IDS.includes(value.toLowerCase());
}

/** Base profile path for a section, e.g. `/…/the-doon-school/admissions/`. */
export function schoolSectionPath(basePath: string, section?: string | null) {
  const normalizedBase = withTrailingSlash(basePath);
  if (!section || section === "overview") return normalizedBase;
  return `${normalizedBase}${section.toLowerCase()}/`;
}
