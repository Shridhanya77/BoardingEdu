"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type {
  BoardListItem,
  CityListItem,
  CountryListItem,
  LocationListItem,
  SchoolTypeListItem,
} from "@/lib/api";
import {
  homeSchoolCategories,
  toSeoSlug,
  type HomeSchoolCategory,
} from "@/lib/seo-slugs";
import { boardListingPath, placeListingPath, schoolDirectoryPath } from "@/lib/school-urls";

type Props = {
  cities?: CityListItem[];
  boards?: BoardListItem[];
  countries?: CountryListItem[];
  locations?: LocationListItem[];
  schoolTypes?: SchoolTypeListItem[];
  dataError?: string | null;
};

const CITY_LINK_LIMIT = 24;
const STATE_LINK_LIMIT = 12;
const LOCALITY_LINK_LIMIT = 16;
/** How many boards / cities / states feed the combined footer searches. */
const BOARD_FANOUT = 12;
const CITY_FANOUT = 8;
const STATE_FANOUT = 6;

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

/**
 * Footer "popular searches" links. Every entry combines an education board, a
 * school-type family and a place (board × type × state/city) so the footer
 * surfaces the long-tail searches parents actually type — without splitting
 * them into separate sections.
 */
export default function SiteFooterSeo({
  cities = [],
  boards = [],
  countries = [],
  locations = [],
  schoolTypes = [],
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
    () => uniqueBy(boards, (board) => board.board_id).slice(0, BOARD_FANOUT),
    [boards],
  );

  const topCities = useMemo(
    () => popularCities.filter((city) => (city.schools_count ?? 0) > 0).slice(0, CITY_FANOUT),
    [popularCities],
  );

  const topStates = useMemo(() => stateSearches.slice(0, STATE_FANOUT), [stateSearches]);

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

  // One flat list of combined searches: "<Board> <Type> Schools in <Place>",
  // plus plain place-by-type links for the most popular cities and states.
  const popularSearches = useMemo(() => {
    const links: { label: string; href: string }[] = [];

    for (const { category, label } of availableCategories) {
      for (const board of topBoards) {
        links.push({
          label: `${board.board_name} ${label}`,
          href: boardListingPath(board.slug, category),
        });
      }

      for (const city of topCities) {
        links.push({
          label: `${label} in ${city.city_name}`,
          href: placeListingPath({
            countrySlug: city.country_slug ?? city.country_name,
            stateSlug: city.state_slug ?? city.state_name,
            citySlug: city.slug,
            category,
          }),
        });
      }
      for (const [, state] of topStates) {
        links.push({
          label: `${label} in ${state.name}`,
          href: placeListingPath({
            countrySlug: state.countrySlug,
            stateSlug: state.stateSlug,
            category,
          }),
        });
      }
      for (const place of localitySearches.slice(0, 8)) {
        links.push({
          label: `${label} in ${place.location.location_name}, ${place.city.city_name}`,
          href: placeListingPath({
            countrySlug: place.city.country_slug ?? place.city.country_name,
            stateSlug: place.city.state_slug ?? place.city.state_name,
            citySlug: place.city.slug,
            locationSlug: place.location.slug,
            category,
          }),
        });
      }
    }

    for (const board of topBoards) {
      links.push({
        label: `${board.board_name} schools`,
        href: boardListingPath(board.slug),
      });
    }

    links.push(
      { label: "All schools", href: schoolDirectoryPath() },
      { label: "Day schools", href: schoolDirectoryPath("day-school") },
      { label: "Boarding schools", href: schoolDirectoryPath("residential-school") },
    );

    for (const city of popularCities) {
      links.push({
        label: `Schools in ${city.city_name}`,
        href: placeListingPath({
          countrySlug: city.country_slug ?? city.country_name,
          stateSlug: city.state_slug ?? city.state_name,
          citySlug: city.slug,
        }),
      });
    }

    for (const [, state] of stateSearches) {
      links.push({
        label: `Schools in ${state.name}`,
        href: placeListingPath({
          countrySlug: state.countrySlug,
          stateSlug: state.stateSlug,
        }),
      });
    }

    for (const country of countrySearches) {
      links.push({
        label: `Schools in ${country.country_name}`,
        href: placeListingPath({ countrySlug: country.slug }),
      });
    }

    for (const place of localitySearches) {
      links.push({
        label: `Schools in ${place.location.location_name}, ${place.city.city_name}`,
        href: place.href,
      });
    }

    return uniqueBy(links, (item) => item.href);
  }, [availableCategories, countrySearches, localitySearches, popularCities, stateSearches, topBoards, topCities, topStates]);

  return (
    <footer className="seo-footer" id="sitemap">
      <nav className="seo-footer__popular" aria-label="Popular school searches">
        {dataError && <p className="seo-footer__error" role="status">{dataError}</p>}
        {popularSearches.length > 0 && (
          <>
            <h3 className="seo-footer__popular-heading">Popular school searches</h3>
            <ul className="seo-footer__link-cloud">
              {popularSearches.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

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
          <span>School discovery and admission guidance</span>
          <p>Find and compare schools across India, then get free guidance for your admission search.</p>
          <a href="mailto:hello@boardingedu.com">hello@boardingedu.com</a>
          <a href="tel:+918046110000">+91 80-4611-0000</a>
        </div>
        <nav className="seo-footer__utility-links" aria-label="More BoardingEdu links">
          <Link href="/schools/">All schools</Link>
          <Link href="/schools/day-school/">Day schools</Link>
          <Link href="/schools/boarding-school/">Boarding schools</Link>
          <Link href="/compare/">Compare schools</Link>
          <Link href="/guides/">School guides</Link>
          <Link href="/counselling/">Free counselling</Link>
          <Link href="/signup/">List your school</Link>
          <Link href="/login/">Log in</Link>
          <Link href="/privacy/">Privacy policy</Link>
          <Link href="/terms/">Terms of use</Link>
        </nav>
      </div>

      <div className="seo-footer__badges">
        <span>Free school search</span>
        <span>Compare education boards</span>
        <span>Free admission guidance</span>
      </div>
      <div className="seo-footer__legal">
        <p>© 2026 BoardingEdu Technologies Pvt. Ltd. · All rights reserved.</p>
        <nav aria-label="Legal">
          <Link href="/privacy/">Privacy Policy</Link>
          <Link href="/terms/">Terms of Use</Link>
          <Link href="/cookies/">Cookie Policy</Link>
          <Link href="/grievance/">Grievance Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
