"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import CallbackRequestModal from "@/components/contact/CallbackRequestModal";
import type {
  BoardListItem,
  CityListItem,
  CountryListItem,
  LocationListItem,
  SchoolTypeListItem,
} from "@/lib/api";
import { INDIA_REGIONS } from "@/lib/india-regions";
import {
  homeSchoolCategories,
  toSeoSlug,
  type HomeSchoolCategory,
} from "@/lib/seo-slugs";
import { boardListingPath, indiaRegionListingPath, placeListingPath, schoolDirectoryPath } from "@/lib/school-urls";

type Props = {
  cities?: CityListItem[];
  boards?: BoardListItem[];
  countries?: CountryListItem[];
  locations?: LocationListItem[];
  schoolTypes?: SchoolTypeListItem[];
  dataError?: string | null;
};

const CITY_LINK_LIMIT = 12;

function citySearchPath(
  city: CityListItem,
  options?: { category?: HomeSchoolCategory; board?: string },
) {
  const path = placeListingPath({
    countrySlug: city.country_slug ?? city.country_name,
    stateSlug: city.state_slug ?? city.state_name,
    citySlug: city.slug,
    category: options?.category,
  });
  if (!options?.board) return path;
  const url = new URL(path, "https://boardingeu.invalid");
  url.searchParams.set("board", options.board);
  return `${url.pathname}${url.search}`;
}
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
  dataError,
}: Props) {
  const [callbackOpen, setCallbackOpen] = useState(false);
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

  const footerCities = popularCities.slice(0, 10);
  const cbse = topBoards.find((board) => /cbse/i.test(`${board.board_code} ${board.slug} ${board.board_name}`));
  const ib = topBoards.find((board) => /\bib\b/i.test(`${board.board_code} ${board.slug} ${board.board_name}`));
  const international = topBoards.find((board) =>
    board !== ib && /cambridge|igcse|international/i.test(`${board.board_code} ${board.slug} ${board.board_name}`),
  );
  const footerGroups = [
    {
      title: "Boarding Schools in Popular Cities",
      links: footerCities.map((city) => ({
        label: `Boarding Schools in ${city.city_name}`,
        href: citySearchPath(city, { category: "residential-school" }),
      })),
    },
    {
      title: "Day Schools in Popular Cities",
      links: footerCities.map((city) => ({
        label: `Schools in ${city.city_name}`,
        href: citySearchPath(city, { category: "day-school" }),
      })),
    },
    ...(cbse ? [{
      title: "CBSE Schools in Popular Cities",
      links: footerCities.map((city) => ({
        label: `CBSE Schools in ${city.city_name}`,
        href: citySearchPath(city, { board: cbse.slug }),
      })),
    }] : []),
    ...(international ? [{
      title: "International Schools in Popular Cities",
      links: footerCities.map((city) => ({
        label: `International Schools in ${city.city_name}`,
        href: citySearchPath(city, { board: international.slug }),
      })),
    }] : []),
    ...(ib ? [{
      title: "IB Schools in Popular Cities",
      links: footerCities.map((city) => ({
        label: `IB Schools in ${city.city_name}`,
        href: citySearchPath(city, { board: ib.slug }),
      })),
    }] : []),
    {
      title: "Popular Boarding Searches",
      links: [
        { label: "Boarding Schools for Girls in India", href: "/india/boarding-schools/?gender=GIRLS" },
        { label: "Boarding Schools for Boys in India", href: "/india/boarding-schools/?gender=BOYS" },
        { label: "Coed Boarding Schools in India", href: "/india/boarding-schools/?gender=COED" },
        ...footerCities.slice(0, 4).map((city) => ({
          label: `Boarding Schools in ${city.city_name}`,
          href: citySearchPath(city, { category: "residential-school" }),
        })),
      ],
    },
    {
      title: "Schools by Category",
      links: [
        { label: "Day Schools in India", href: placeListingPath({ countrySlug: "india", category: "day-school" }) },
        { label: "Boarding Schools in India", href: placeListingPath({ countrySlug: "india", category: "residential-school" }) },
        { label: "Explore All Schools", href: schoolDirectoryPath() },
        { label: "Compare Schools", href: "/compare/" },
      ],
    },
    {
      title: "About BoardingEdu",
      links: [
        { label: "About Us", href: "/about/" },
        { label: "Contact Us", href: "/contact/" },
        { label: "Privacy Policy", href: "/privacy/" },
        { label: "Terms of Use", href: "/terms/" },
      ],
    },
  ];
  const directoryGroups = [
    ...footerGroups,
    ...(schoolTypeLinks.length
      ? [{ title: "Browse School Types", links: schoolTypeLinks }]
      : []),
    ...locationGroups,
    ...boardGroups,
  ];

  return (
    <footer className="seo-footer seo-footer--directory" id="sitemap">
      {dataError && <p className="seo-footer__error" role="status">{dataError}</p>}
      <nav className="seo-footer__directory" aria-label="School directory and popular searches">
        {directoryGroups.filter((group) => group.links.length > 0).map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {uniqueBy(group.links, (item) => `${item.label}-${item.href}`).map((item) => (
                <li key={`${group.title}-${item.href}`}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <div className="seo-footer__legal">
        <p>© 2026 BoardingEdu Technologies Pvt. Ltd. · All rights reserved.</p>
        <nav aria-label="Legal">
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
          <Link href="/about/">About</Link>
          <Link href="/contact/">Contact</Link>
        </nav>
      </div>
      <div className="callback-dock">
        <a className="callback-dock__phone" href="tel:+918046110000" aria-label="Call BoardingEdu">
          <Phone size={18} />
        </a>
        <button type="button" className="callback-dock__action" onClick={() => setCallbackOpen(true)}>
          Request a Callback
        </button>
      </div>
      <CallbackRequestModal isOpen={callbackOpen} onClose={() => setCallbackOpen(false)} />
    </footer>
  );
}
