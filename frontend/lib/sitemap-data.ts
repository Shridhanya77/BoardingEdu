import type { MetadataRoute } from "next";
import { fetchAllPages, geography, schools } from "@/lib/api";
import { guideList } from "@/lib/guides";
import { boardListingPath, placeListingPath, schoolDirectoryPath, schoolListPath } from "@/lib/school-urls";
import { toSeoSlug, withTrailingSlash } from "@/lib/seo-slugs";
import { SITE_URL } from "@/lib/site";

export const MAX_URLS_PER_SITEMAP = 50_000;

function loc(path: string): string {
  return `${SITE_URL}${withTrailingSlash(path)}`;
}

function lastModified(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function getSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: loc("/"), changeFrequency: "daily", priority: 1 },
    { url: loc("/schools"), changeFrequency: "daily", priority: 0.9 },
    { url: loc(schoolDirectoryPath("day-school")), changeFrequency: "daily", priority: 0.85 },
    { url: loc(schoolDirectoryPath("residential-school")), changeFrequency: "daily", priority: 0.85 },
    { url: loc("/compare"), changeFrequency: "weekly", priority: 0.4 },
    { url: loc("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: loc("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: loc("/cookies"), changeFrequency: "yearly", priority: 0.2 },
    { url: loc("/grievance"), changeFrequency: "yearly", priority: 0.2 },
    { url: loc("/guides"), changeFrequency: "weekly", priority: 0.6 },
  ];

  for (const guide of guideList()) {
    entries.push({
      url: loc(`/guides/${guide.slug}`),
      lastModified: lastModified(guide.updated),
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  try {
    const [countryPage, cityPage, boardPage, schoolPage] = await Promise.all([
      geography.countries(),
      geography.cities(),
      schools.boards(),
      schools.list({ status: true, ordering: "school_name", page_size: 100 }),
    ]);
    const [countries, cities, boards, schoolRows] = await Promise.all([
      fetchAllPages(countryPage),
      fetchAllPages(cityPage),
      fetchAllPages(boardPage),
      fetchAllPages(schoolPage, 10_000),
    ]);

    for (const country of countries.filter((item) => item.status)) {
      entries.push({
        url: loc(`/home/${toSeoSlug(country.slug)}`),
        lastModified: lastModified(country.updated_at),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    const populatedCities = cities.filter((item) => item.status && (item.schools_count ?? 0) > 0);
    for (const city of populatedCities) {
      const country = toSeoSlug(city.country_slug ?? city.country_name);
      const state = toSeoSlug(city.state_slug ?? city.state_name);
      const citySlug = toSeoSlug(city.slug);
      for (const category of ["day-school", "residential-school"] as const) {
        entries.push({
          url: loc(placeListingPath({
            countrySlug: country,
            stateSlug: state,
            citySlug,
            category,
          })),
          lastModified: lastModified(city.updated_at),
          changeFrequency: "weekly",
          priority: category === "day-school" ? 0.7 : 0.65,
        });
      }
    }

    const states = new Map<string, { country: string; state: string }>();
    for (const city of populatedCities) {
      const country = toSeoSlug(city.country_slug ?? city.country_name);
      const state = toSeoSlug(city.state_slug ?? city.state_name);
      states.set(`${country}/${state}`, { country, state });
    }
    for (const { country, state } of states.values()) {
      entries.push({
        url: loc(`/${country}/${state}`),
        changeFrequency: "weekly",
        priority: 0.7,
      });
      entries.push({
        url: loc(placeListingPath({
          countrySlug: country,
          stateSlug: state,
          category: "residential-school",
        })),
        changeFrequency: "weekly",
        priority: 0.65,
      });
    }

    for (const board of boards.filter((item) => item.status)) {
      entries.push({
        url: loc(boardListingPath(board.slug)),
        lastModified: lastModified(board.updated_at),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const school of schoolRows.filter((item) => item.status && item.slug)) {
      entries.push({
        url: loc(schoolListPath(school)),
        lastModified: lastModified(school.updated_at),
        changeFrequency: "weekly",
        priority: school.is_featured ? 0.8 : 0.55,
      });
    }
  } catch (error) {
    console.error("Could not load dynamic sitemap entries from the school API.", error);
  }

  const uniqueEntries = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of entries) {
    uniqueEntries.set(entry.url, entry);
  }
  return [...uniqueEntries.values()];
}

export async function getSitemapPageCount(): Promise<number> {
  const entryCount = (await getSitemapEntries()).length;
  return Math.max(1, Math.ceil(entryCount / MAX_URLS_PER_SITEMAP));
}

export function sitemapPage(
  entries: MetadataRoute.Sitemap,
  pageId: number,
): MetadataRoute.Sitemap {
  const start = pageId * MAX_URLS_PER_SITEMAP;
  return entries.slice(start, start + MAX_URLS_PER_SITEMAP);
}
