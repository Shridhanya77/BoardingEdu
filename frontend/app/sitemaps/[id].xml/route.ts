import { NextResponse } from "next/server";
import { getSitemapEntries, MAX_URLS_PER_SITEMAP, sitemapPage } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const pageId = Number(params.id);
  if (!Number.isSafeInteger(pageId) || pageId < 1) {
    return new NextResponse("Not found", { status: 404 });
  }

  const entries = await getSitemapEntries();
  const start = pageId * MAX_URLS_PER_SITEMAP;
  if (start >= entries.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  const page = sitemapPage(entries, pageId);
  const urls = page.map((entry) => [
    "  <url>",
    `    <loc>${escapeXml(entry.url)}</loc>`,
    ...(entry.lastModified
      ? [`    <lastmod>${escapeXml(new Date(entry.lastModified).toISOString())}</lastmod>`]
      : []),
    ...(entry.changeFrequency ? [`    <changefreq>${entry.changeFrequency}</changefreq>`] : []),
    ...(entry.priority !== undefined ? [`    <priority>${entry.priority}</priority>`] : []),
    "  </url>",
  ].join("\n"));
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
