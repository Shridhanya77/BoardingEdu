import { withTrailingSlash } from "@/lib/seo-slugs";

/**
 * Single source of truth for the section navigation on a school profile page.
 * The `id` follows the school slug before the geographic segments, so
 * `/the-doon-school/admissions/krishna-nagar/dehradun/uttarakhand/india/`
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
  { id: "faq", label: "FAQ" },
] as const;

export type SchoolSectionId = (typeof schoolSections)[number]["id"];

const SCHOOL_SECTION_IDS = schoolSections.map((section) => section.id) as readonly string[];

export function isSchoolSectionId(value?: string | null): value is SchoolSectionId {
  return typeof value === "string" && SCHOOL_SECTION_IDS.includes(value.toLowerCase());
}

/** Base profile path for a section, e.g. `/the-doon-school/admissions/…/`. */
export function schoolSectionPath(basePath: string, section?: string | null) {
  const normalizedBase = withTrailingSlash(basePath);
  if (!section || section === "overview") return normalizedBase;
  const segments = normalizedBase.split("/").filter(Boolean);
  return withTrailingSlash(
    `/${segments[0]}/${section.toLowerCase()}/${segments.slice(1).join("/")}`,
  );
}

const SECTION_DESCRIPTION: Record<Exclude<SchoolSectionId, "overview">, (school: string, city: string) => string> = {
  fees: (school, city) => `See the published fee structure for ${school} in ${city}, including annual fees by grade.`,
  admissions: (school, city) => `Check grades, seats and admission details for ${school} in ${city}.`,
  facilities: (school, city) => `Explore campus facilities listed for ${school} in ${city}.`,
  infrastructure: (school, city) => `See the infrastructure details published for ${school} in ${city}.`,
  media: (school, city) => `Browse photos and videos of ${school} in ${city}.`,
  reviews: (school, city) => `Read parent reviews and ratings for ${school} in ${city}.`,
  location: (school, city) => `Find the address and location of ${school} in ${city}.`,
  faq: (school, city) => `Answers to common questions about ${school} in ${city}, including board, fees, grades and admissions.`,
};

const SECTION_KEYWORDS: Record<SchoolSectionId, (school: string, city: string) => string[]> = {
  overview: (school, city) => [`${school} overview`, `${school} school`, `schools in ${city}`],
  fees: (school, city) => [`${school} fees`, `${school} school fees`, `school fees in ${city}`],
  admissions: (school, city) => [`${school} admissions`, `${school} admission process`, `school admissions in ${city}`],
  facilities: (school, city) => [`${school} facilities`, `${school} school facilities`, `school facilities in ${city}`],
  infrastructure: (school, city) => [`${school} infrastructure`, `${school} campus`, `school infrastructure in ${city}`],
  media: (school, city) => [`${school} photos`, `${school} videos`, `${school} campus photos in ${city}`],
  reviews: (school, city) => [`${school} reviews`, `${school} parent reviews`, `school reviews in ${city}`],
  location: (school, city) => [`${school} location`, `${school} address`, `schools in ${city}`],
  faq: (school) => [`${school} FAQs`, `${school} questions`, `${school} fees and admissions`],
};

/** Title and meta description for one school profile section. */
export function schoolSectionSeo({
  schoolName,
  city,
  section = "overview",
  overviewDescription,
}: {
  schoolName: string;
  city: string;
  section?: SchoolSectionId;
  overviewDescription: string;
}) {
  if (section === "overview") {
    return {
      title: `${schoolName} | ${city} School | BoardingEdu`,
      description: overviewDescription,
      keywords: SECTION_KEYWORDS.overview(schoolName, city),
    };
  }
  const label = schoolSections.find((item) => item.id === section)?.label ?? "Overview";
  return {
    title: `${schoolName} ${label} | ${city} School | BoardingEdu`,
    description: SECTION_DESCRIPTION[section](schoolName, city),
    keywords: SECTION_KEYWORDS[section](schoolName, city),
  };
}
