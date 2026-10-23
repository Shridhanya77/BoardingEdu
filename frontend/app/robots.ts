import type { MetadataRoute } from "next";
import { getSitemapPageCount } from "@/lib/sitemap-data";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitemapCount = await getSitemapPageCount();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/login", "/signup", "/backend-api/", "/api/"],
      },
      {
        userAgent: ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"],
        allow: "/",
      },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      ...Array.from({ length: sitemapCount - 1 }, (_, index) =>
        `${SITE_URL}/sitemaps/${index + 1}.xml`,
      ),
    ],
    host: SITE_URL,
  };
}
