import type { SchoolDetail } from "@/lib/api";
import { SITE_EMAIL, SITE_NAME, SITE_PHONE, SITE_URL } from "@/lib/site";
import { absoluteUrl } from "@/lib/seo";
import { schoolProfilePathFromSlugs, schoolProfileTypeSegment } from "@/lib/seo-slugs";

export type JsonLd = Record<string, unknown>;

export type Breadcrumb = { name: string; url: string };

/** Canonical, SEO-friendly path for a school profile. */
export function schoolCanonicalPath(school: SchoolDetail): string {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_detail.slug,
    stateSlug: school.state_detail.slug,
    citySlug: school.city_detail.slug,
    localitySlug: school.location_detail?.slug,
    schoolSlug: school.slug,
    typeSegment: schoolProfileTypeSegment(school.school_types_detail),
  });
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    email: SITE_EMAIL,
    telephone: SITE_PHONE,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/BoardingEdu_LOGO.jpeg`,
    },
    description:
      "A school discovery platform helping families explore day and boarding schools, compare options, and request admission counselling.",
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/schools/search/{search_term_string}/`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function breadcrumbJsonLd(items: Breadcrumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function itemListJsonLd(options: {
  name: string;
  items: { name: string; url: string }[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: options.name,
    numberOfItems: options.items.length,
    itemListElement: options.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  };
}

export type AggregateRating = {
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
};

/**
 * Full schema.org/School graph for a profile page.
 * Includes BreadcrumbList so Google can render breadcrumb rich results.
 */
export function schoolJsonLd(
  school: SchoolDetail,
  options?: { aggregateRating?: AggregateRating | null; breadcrumbs?: Breadcrumb[] },
): JsonLd {
  const path = schoolCanonicalPath(school);
  const url = absoluteUrl(path);

  const images = [
    school.school_image_url,
    ...(school.photos_detail ?? []).map((photo) => photo.photo_url),
  ].filter((value): value is string => Boolean(value));

  const locality = [
    school.location_detail?.location_name,
    school.city_detail.city_name,
    school.state_detail.state_name,
    school.country_detail.country_name,
  ]
    .filter(Boolean)
    .join(", ");

  const sameAs = (school.videos_detail ?? [])
    .map((video) => video.video_url)
    .filter((value): value is string => Boolean(value));

  const graph: JsonLd[] = [
    {
      "@type": "School",
      "@id": `${url}#school`,
      name: school.school_name,
      alternateName: school.short_name || undefined,
      url,
      description: `${school.school_name} is a school located in ${locality}. Explore its boards, fees and facilities on ${SITE_NAME}.`,
      logo: school.school_logo_url || undefined,
      image: images.length ? images : undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: school.address || undefined,
        addressLocality: school.city_detail.city_name,
        addressRegion: school.state_detail.state_name,
        postalCode: school.pincode || undefined,
        addressCountry: school.country_detail.country_code || school.country_detail.country_name,
      },
      geo:
        school.lat != null && school.lng != null
          ? {
              "@type": "GeoCoordinates",
              latitude: String(school.lat),
              longitude: String(school.lng),
            }
          : undefined,
      telephone: school.phone || undefined,
      email: school.email || undefined,
      foundingDate: school.established_year ? String(school.established_year) : undefined,
      sameAs: sameAs.length ? sameAs : undefined,
      amenityFeature: (school.facilities_detail ?? []).length
        ? school.facilities_detail.map((facility) => ({
            "@type": "LocationFeatureSpecification",
            name: facility.facility_name,
            value: true,
          }))
        : undefined,
      aggregateRating: options?.aggregateRating
        ? {
            "@type": "AggregateRating",
            ratingValue: options.aggregateRating.ratingValue,
            reviewCount: options.aggregateRating.reviewCount,
            bestRating: options.aggregateRating.bestRating ?? 5,
            worstRating: options.aggregateRating.worstRating ?? 1,
          }
        : undefined,
    },
  ];

  if (options?.breadcrumbs?.length) {
    graph.push(breadcrumbJsonLd(options.breadcrumbs));
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
