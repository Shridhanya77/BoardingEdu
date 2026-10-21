import type { MetadataRoute } from "next";
import { fetchAllPages, geography, schools } from "@/lib/api";
import { guideList } from "@/lib/guides";
import { boardListingPath, placeListingPath, schoolListPath } from "@/lib/school-urls";
import { toSeoSlug, withTrailingSlash } from "@/lib/seo-slugs";
import { SITE_URL } from "@/lib/site";

function loc(path: string): string {
  return `${SITE_URL}${withTrailingSlash(path)}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: loc("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: loc("/schools"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: loc("/compare"), lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: loc("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: loc("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: loc("/cookies"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: loc("/grievance"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: loc("/guides"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  for (const guide of guideList()) {
    entries.push({
      url: loc(`/guides/${guide.slug}`),
      lastModified: new Date(guide.updated),
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  try {
    const [countryPage, cityPage, boardPage, schoolPage] = await Promise.all([
      geography.countries(),
      geography.cities(),
      schools.boards(),
      schools.list({ status: true, ordering: "school_name" }),
    ]);
    const [countries, cities, boards, schoolRows] = await Promise.all([
      fetchAllPages(countryPage),
      fetchAllPages(cityPage),
      fetchAllPages(boardPage),
      fetchAllPages(schoolPage),
    ]);

    // Country-level landing pages: /home/{country}
    for (const country of countries.filter((item) => item.status)) {
      entries.push({
        url: loc(`/home/${toSeoSlug(country.slug)}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const city of cities.filter((item) => item.status && (item.schools_count ?? 0) > 0)) {
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
          lastModified: now,
          changeFrequency: "weekly",
          priority: category === "day-school" ? 0.7 : 0.65,
        });
      }
    }

    const states = new Map<string, { country: string; state: string }>();
    for (const city of cities.filter((item) => item.status && (item.schools_count ?? 0) > 0)) {
      const country = toSeoSlug(city.country_slug ?? city.country_name);
      const state = toSeoSlug(city.state_slug ?? city.state_name);
      states.set(`${country}/${state}`, { country, state });
    }
    for (const { country, state } of states.values()) {
      // State directory page and the state-level boarding listing.
      entries.push({
        url: loc(`/${country}/${state}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
      entries.push({
        url: loc(`/${country}/${state}/boarding-schools`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.65,
      });
    }

    for (const board of boards.filter((item) => item.status)) {
      entries.push({
        url: loc(boardListingPath(board.slug)),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const school of schoolRows.filter((item) => item.status)) {
      entries.push({
        url: loc(schoolListPath(school)),
        lastModified: now,
        changeFrequency: "weekly",
        priority: school.is_featured ? 0.8 : 0.55,
      });
    }
  } catch (error) {
    console.error("Could not load dynamic sitemap entries from the school API.", error);
  }

  return entries;
}
