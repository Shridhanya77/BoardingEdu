import type { Metadata } from "next";
import { withTrailingSlash } from "@/lib/seo-slugs";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMetadata({
  title,
  description,
  path,
  keywords = [],
  index = true,
  image,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  index?: boolean;
  image?: string | null;
}): Metadata {
  const canonicalPath = path.startsWith("http") ? path : withTrailingSlash(path);
  const url = absoluteUrl(canonicalPath);
  const ogImage = image || `${SITE_URL}/BoardingEdu_LOGO.jpeg`;
  return {
    title,
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: { canonical: canonicalPath },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export function listingCopy(options: {
  place?: string;
  categoryLabel?: string;
  boardName?: string;
}): { title: string; description: string; heading: string } {
  const place = options.place || "India";
  const category = options.categoryLabel?.replace(/\s+$/, "");
  const subject = [
    options.boardName,
    category ? `${category}s` : undefined,
  ]
    .filter(Boolean)
    .join(" ") || "Schools";
  const heading = `${subject} in ${place}`;
  return {
    heading,
    title: `${heading} | ${SITE_NAME}`,
    description: `Explore ${subject.toLowerCase()} in ${place}. Compare boards, fees, facilities, and contact schools or request free counselling on ${SITE_NAME}.`,
  };
}
