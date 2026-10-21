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
import { toSeoSlug } from "@/lib/seo-slugs";
import { boardListingPath, placeListingPath } from "@/lib/school-urls";

type Props = {
  cities?: CityListItem[];
  boards?: BoardListItem[];
  countries?: CountryListItem[];
  locations?: LocationListItem[];
  schoolTypes?: SchoolTypeListItem[];
  dataError?: string | null;
};

const CITY_LINK_LIMIT = 100;
const STATE_LINK_LIMIT = 100;
const BOARD_LINK_LIMIT = 40;
const TYPE_LINK_LIMIT = 24;
const DISCOVER_BOARD_LIMIT = 8;
const DISCOVER_CITY_LIMIT = 6;
const LOCATION_LINK_LIMIT = 100;

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

function cityPath(city: CityListItem): string {
  return placeListingPath({
    countrySlug: city.country_slug ?? city.country_name,
    stateSlug: city.state_slug ?? city.state_name,
    citySlug: city.slug,
  });
}

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
    () => uniqueCities.slice(0, CITY_LINK_LIMIT),
    [uniqueCities],
  );

  const stateSearches = useMemo(() => {
    const totals = new Map<
      string,
      { countrySlug: string; stateSlug: string; stateId: string; name: string; count: number }
    >();
    for (const city of uniqueCities) {
      const countrySlug = city.country_slug ?? toSeoSlug(city.country_name);
      const stateSlug = city.state_slug ?? toSeoSlug(city.state_name);
      const key = `${countrySlug}/${stateSlug}`;
      const entry = totals.get(key) ?? {
        countrySlug,
        stateSlug,
        stateId: city.state_id,
        name: city.state_name,
        count: 0,
      };
      entry.count += city.schools_count ?? 0;
      totals.set(key, entry);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
      .slice(0, STATE_LINK_LIMIT);
  }, [uniqueCities]);

  const topBoards = useMemo(
    () => uniqueBy(boards, (board) => board.board_id).slice(0, BOARD_LINK_LIMIT),
    [boards],
  );

  const schoolTypeLinks = useMemo(
    () => uniqueBy(schoolTypes, (type) => type.school_type_id).slice(0, TYPE_LINK_LIMIT),
    [schoolTypes],
  );

  const discoverBoards = useMemo(
    () => topBoards.slice(0, DISCOVER_BOARD_LIMIT),
    [topBoards],
  );

  const discoverCities = useMemo(
    () => popularCities.slice(0, DISCOVER_CITY_LIMIT),
    [popularCities],
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

  const localitySearches = useMemo(
    () =>
      uniqueBy(locations, (location) => location.location_id)
        .slice()
        .sort((left, right) => left.location_name.localeCompare(right.location_name))
        .slice(0, LOCATION_LINK_LIMIT),
    [locations],
  );

  const popularSearchLinks = useMemo(() => {
    const links: { label: string; href: string }[] = [];
    const places: { label: string; filter: Record<string, string> }[] = [
      ...countrySearches.map((country) => ({
        label: country.country_name,
        filter: { country: country.country_id },
      })),
      ...stateSearches.map(([, state]) => ({
        label: state.name,
        filter: { state: state.stateId },
      })),
      ...popularCities.map((city) => ({
        label: city.city_name,
        filter: { city: city.city_id },
      })),
      ...localitySearches.map((location) => ({
        label: `${location.location_name}, ${location.city_name}`,
        filter: { location: location.location_id },
      })),
    ];
    const topPlaces: typeof places = [
      ...countrySearches.slice(0, 8).map((country) => ({
        label: country.country_name,
        filter: { country: country.country_id },
      })),
      ...stateSearches.slice(0, 8).map(([, state]) => ({
        label: state.name,
        filter: { state: state.stateId },
      })),
      ...popularCities.slice(0, 8).map((city) => ({
        label: city.city_name,
        filter: { city: city.city_id },
      })),
      ...localitySearches.slice(0, 8).map((location) => ({
        label: `${location.location_name}, ${location.city_name}`,
        filter: { location: location.location_id },
      })),
    ];

    for (const place of topPlaces) {
      links.push({
        label: `Schools in ${place.label}`,
        href: listingSearchPath(place.filter),
      });
    }
    for (const board of topBoards) {
      links.push({
        label: `${board.board_name} schools in India`,
        href: boardListingPath(board.slug),
      });
      for (const type of schoolTypeLinks) {
        links.push({
          label: `${board.board_name} ${type.type_name.toLowerCase()}`,
          href: listingSearchPath({
            board: board.board_id,
            school_type: type.school_type_id,
          }),
        });
      }
      for (const place of topPlaces) {
        links.push({
          label: `${board.board_name} schools in ${place.label}`,
          href: listingSearchPath({ board: board.board_id, ...place.filter }),
        });
      }
    }
    for (const type of schoolTypeLinks) {
      for (const place of places) {
        links.push({
          label: `${type.type_name} in ${place.label}`,
          href: listingSearchPath({ school_type: type.school_type_id, ...place.filter }),
        });
      }
    }
    return uniqueBy(links, (item) => item.href);
  }, [countrySearches, localitySearches, popularCities, schoolTypeLinks, stateSearches, topBoards]);

  return (
    <footer className="seo-footer" id="sitemap">
      <section className="seo-footer__popular" aria-labelledby="popular-searches-heading">
        <div className="seo-footer__popular-heading">
          <h2 id="popular-searches-heading">Popular school searches by board, type and location</h2>
        </div>
        <div className="seo-footer__search-cloud">
          {dataError && <p className="seo-footer__error" role="status">{dataError}</p>}
          {popularSearchLinks.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </div>
      </section>

      <div className="seo-footer__cta">
        <div>
          <h2>Start your school search today — it&apos;s free.</h2>
          <p>Explore schools by location, education board, school type, and admission needs.</p>
        </div>
        <div>
          <Link href="/schools">Find Schools</Link>
          <Link href="/#counselling">Free Counselling</Link>
        </div>
      </div>

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

        <div>
          <h3>Discover</h3>
          <Link href="/schools?type=boarding-school">Boarding schools</Link>
          <Link href="/schools?type=day-school">Day schools</Link>
          <Link href="/compare">Compare schools</Link>
          <Link href="/#featured">Featured school profiles</Link>
          <Link href="/guides">School admission guides</Link>
          <Link href="/guides/how-to-shortlist-boarding-schools">How to shortlist schools</Link>
          <Link href="/guides/cbse-icse-ib-igcse-explained">Boards explained</Link>
          {discoverBoards.map((board) => (
            <Link key={board.board_id} href={boardListingPath(board.slug)}>
              {`${board.board_name} schools`}
            </Link>
          ))}
        </div>
        <div>
          <h3>Counselling</h3>
          <Link href="/#counselling">Free admission counselling</Link>
          <Link href="/schools">CBSE school search</Link>
          <Link href="/schools">IB school search</Link>
          <Link href="/schools">ICSE school search</Link>
          <Link href="/#faq">School admission questions</Link>
        </div>
        <div>
          <h3>For Parents</h3>
          <Link href="/signup">Create parent account</Link>
          <Link href="/login">Parent login</Link>
          <Link href="/compare">School shortlist</Link>
          <Link href="/schools">Enquire with schools</Link>
          {discoverCities.map((city) => (
            <Link key={city.city_id} href={cityPath(city)}>
              {`Schools in ${city.city_name}`}
            </Link>
          ))}
        </div>
        <div>
          <h3>For Schools</h3>
          <Link href="/signup">List your school</Link>
          <Link href="/login">School login</Link>
          <Link href="/login">Manage enquiries</Link>
          <Link href="/#for-schools">School partnerships</Link>
        </div>
        <div>
          <h3>BoardingEdu</h3>
          <Link href="/#about">About BoardingEdu</Link>
          <Link href="/#faq">Frequently asked questions</Link>
          <Link href="/guides">School guides</Link>
          <Link href="/#counselling">Contact counselling</Link>
        </div>
      </div>

      <div className="seo-footer__badges">
        <span>Free school search</span>
        <span>Compare education boards</span>
        <span>Free admission guidance</span>
      </div>
      <div className="seo-footer__legal">
        <p>© 2026 BoardingEdu Technologies Pvt. Ltd. · All rights reserved.</p>
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
          <Link href="/cookies">Cookie Policy</Link>
          <Link href="/grievance">Grievance Policy</Link>
        </nav>
      </div>
    </footer>
  );
}

function listingSearchPath(filters: Record<string, string>) {
  return `/schools?${new URLSearchParams(filters).toString()}`;
}
