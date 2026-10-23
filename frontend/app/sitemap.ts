import type { MetadataRoute } from "next";
import { getSitemapEntries, sitemapPage } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapPage(await getSitemapEntries(), 0);
}
