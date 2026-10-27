"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type {
  BoardListItem,
  CityListItem,
  CountryListItem,
  LocationListItem,
  SchoolListItem,
  SchoolTypeListItem,
} from "@/lib/api";
import { INDIA_REGIONS } from "@/lib/india-regions";
import {
  homeSchoolCategories,
  toSeoSlug,
  type HomeSchoolCategory,
} from "@/lib/seo-slugs";
import { boardListingPath, indiaRegionListingPath, placeListingPath, schoolDirectoryPath, schoolListPath } from "@/lib/school-urls";

type Props = {
  cities?: CityListItem[];
  boards?: BoardListItem[];
  countries?: CountryListItem[];
  locations?: LocationListItem[];
  schoolTypes?: SchoolTypeListItem[];
  topSchools?: SchoolListItem[];
  dataError?: string | null;
};

const CITY_LINK_LIMIT = 24;
const STATE_LINK_LIMIT = 24;
const LOCALITY_LINK_LIMIT = 16;
const FOOTER_CATEGORIES: { category: HomeSchoolCategory; label: string }[] = [
  { category: "day-school", label: "Day Schools" },
  { category: "residential-school", label: "Boarding Schools" },
];

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

export default function SiteFooterSeo({
  cities = [],
  boards = [],
  countries = [],
  locations = [],
  schoolTypes = [],
  topSchools = [],
  dataError,
}: Props) {
  const uniqueCities = useMemo(() => uniqueBy(cities, (city) => city.city_id), [cities]);

  const popularCities = useMemo(
    () => uniqueCities.filter((city) => (city.schools_count ?? 0) > 0).slice(0, CITY_LINK_LIMIT),
    [uniqueCities],
  );

  const stateSearches = useMemo(() => {
    const totals = new Map<
      string,
      { countrySlug: string; stateSlug: string; name: string; count: number }
    >();
    for (const city of uniqueCities) {
      const countrySlug = city.country_slug ?? toSeoSlug(city.country_name);
      const stateSlug = city.state_slug ?? toSeoSlug(city.state_name);
      const key = `${countrySlug}/${stateSlug}`;
      const entry = totals.get(key) ?? {
        countrySlug,
        stateSlug,
        name: city.state_name,
        count: 0,
      };
      entry.count += city.schools_count ?? 0;
      totals.set(key, entry);
    }
    return [...totals.entries()]
      .filter(([, state]) => state.count > 0)
      .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
      .slice(0, STATE_LINK_LIMIT);
  }, [uniqueCities]);

  const topBoards = useMemo(
    () =>
      uniqueBy(boards, (board) => board.board_id)
        .filter((board) => board.status)
        .sort((left, right) => left.board_name.localeCompare(right.board_name)),
    [boards],
  );

  const localitySearches = useMemo(() => {
    const cityById = new Map(uniqueCities.map((city) => [city.city_id, city]));
    return uniqueBy(
      locations.filter((location) => location.status && location.slug),
      (location) => location.location_id,
    )
      .flatMap((location) => {
        const city = cityById.get(location.city_id);
        if (!city || (city.schools_count ?? 0) <= 0) return [];
        return [{
          location,
          city,
          href: placeListingPath({
            countrySlug: city.country_slug ?? city.country_name,
            stateSlug: city.state_slug ?? city.state_name,
            citySlug: city.slug,
            locationSlug: location.slug,
          }),
        }];
      })
      .sort(
        (left, right) =>
          (right.city.schools_count ?? 0) - (left.city.schools_count ?? 0) ||
          left.location.location_name.localeCompare(right.location.location_name),
      )
      .slice(0, LOCALITY_LINK_LIMIT);
  }, [locations, uniqueCities]);

  const availableCategories = useMemo(
    () =>
      FOOTER_CATEGORIES.filter(({ category }) =>
        schoolTypes.some((type) =>
          homeSchoolCategories(type.type_code, type.slug, type.type_name).includes(category),
        ),
      ),
    [schoolTypes],
  );

  const countrySearches = useMemo(() => {
    const schoolCounts = new Map<string, number>();
    for (const city of uniqueCities) {
      schoolCounts.set(
        city.country_id,
        (schoolCounts.get(city.country_id) ?? 0) + (city.schools_count ?? 0),
      );
    }
    return countries
      .filter((country) => schoolCounts.has(country.country_id))
      .sort(
        (left, right) =>
          (schoolCounts.get(right.country_id) ?? 0) - (schoolCounts.get(left.country_id) ?? 0) ||
          left.country_name.localeCompare(right.country_name),
      );
  }, [countries, uniqueCities]);

  const indiaRegionLinks = useMemo(() => {
    const india = countrySearches.find(
      (country) => toSeoSlug(country.slug || country.country_name) === "india",
    );
    if (!india) return [];
    return INDIA_REGIONS.flatMap((region) => [
      {
        label: `All schools in ${region.label}`,
        href: indiaRegionListingPath(region.id),
      },
      ...availableCategories.map(({ category, label }) => ({
        label: `${label} in ${region.label}`,
        href: indiaRegionListingPath(region.id, category),
      })),
    ]);
  }, [availableCategories, countrySearches]);

  const locationGroups = useMemo(() => {
    const locationLinks = (
      label: string,
      path: Parameters<typeof placeListingPath>[0],
    ) => [
      { label: `All schools in ${label}`, href: placeListingPath(path) },
      ...availableCategories.map(({ category, label: categoryLabel }) => ({
        label: `${categoryLabel} in ${label}`,
        href: placeListingPath({ ...path, category }),
      })),
    ];

    return [
      {
        title: "By country",
        links: countrySearches.flatMap((country) =>
          locationLinks(country.country_name, { countrySlug: country.slug }),
        ),
      },
      {
        title: "By region",
        links: indiaRegionLinks,
      },
      {
        title: "By state",
        links: stateSearches.flatMap(([, state]) =>
          locationLinks(state.name, {
            countrySlug: state.countrySlug,
            stateSlug: state.stateSlug,
          }),
        ),
      },
      {
        title: "By city",
        links: popularCities.flatMap((city) =>
          locationLinks(city.city_name, {
            countrySlug: city.country_slug ?? city.country_name,
            stateSlug: city.state_slug ?? city.state_name,
            citySlug: city.slug,
          }),
        ),
      },
      {
        title: "By locality",
        links: localitySearches.flatMap(({ location, city }) =>
          locationLinks(location.location_name, {
            countrySlug: city.country_slug ?? city.country_name,
            stateSlug: city.state_slug ?? city.state_name,
            citySlug: city.slug,
            locationSlug: location.slug,
          }),
        ),
      },
    ];
  }, [availableCategories, countrySearches, indiaRegionLinks, localitySearches, popularCities, stateSearches]);

  const boardGroups = useMemo(
    () =>
      availableCategories.map(({ category, label }) => ({
        title: `${label} by board`,
        links: topBoards.map((board) => ({
          label: `${board.board_name} ${label}`,
          href: boardListingPath(board.slug, category),
        })),
      })),
    [availableCategories, topBoards],
  );

  const schoolTypeLinks = useMemo(
    () =>
      availableCategories.map(({ category, label }) => ({
        label,
        href: schoolDirectoryPath(category),
      })),
    [availableCategories],
  );

  const footerGroups = [
    { title: "By school type", links: schoolTypeLinks },
    ...boardGroups.map((group) => ({ ...group, links: group.links.slice(0, 12) })),
    ...locationGroups.map((group) => ({ ...group, links: group.links.slice(0, 18) })),
    {
      title: "Top 10 schools",
      links: topSchools.length
        ? topSchools.slice(0, 10).map((school) => ({
            label: school.school_name,
            href: schoolListPath(school),
          }))
        : [{ label: "Browse all schools", href: schoolDirectoryPath() }],
    },
    {
      title: "More from BoardingEdu",
      links: [
        { label: "All schools", href: schoolDirectoryPath() },
        { label: "Compare schools", href: "/compare/" },
        { label: "School guides", href: "/guides/" },
        { label: "List your school", href: "/signup/" },
        { label: "Log in", href: "/login/" },
      ],
    },
  ];

  return (
    <footer className="seo-footer" id="sitemap">
      {dataError && <p className="seo-footer__error" role="status">{dataError}</p>}
      <div className="seo-footer__grid">
        <div className="seo-footer__brand">
          <Image
            className="brand__image"
            src="/BoardingEdu_LOGO.jpeg"
            alt="BoardingEdu"
            width={48}
            height={48}
          />
          <strong>BoardingEdu</strong>
          <span>Find a school that fits</span>
          <p>Compare schools by location, board, and fees.</p>
          <a href="mailto:hello@boardingedu.com">hello@boardingedu.com</a>
          <a href="tel:+918046110000">+91 80-4611-0000</a>
        </div>

        <nav className="seo-footer__columns" aria-label="Explore schools">
          {footerGroups.map((group) => (
            <details className="seo-footer__column seo-footer__browse-group" key={group.title}>
              <summary>{group.title}</summary>
              <ul>
                {uniqueBy(group.links, (item) => item.href).map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </nav>
      </div>
      <div className="seo-footer__legal">
        <p>© 2026 BoardingEdu Technologies Pvt. Ltd. · All rights reserved.</p>
        <nav aria-label="Legal">
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
          <Link href="/cookies/">Cookies</Link>
          <Link href="/grievance/">Grievance</Link>
        </nav>
      </div>
    </footer>
  );
}
