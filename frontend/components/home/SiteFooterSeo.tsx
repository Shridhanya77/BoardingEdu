"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Phone, Mail, MapPin } from "lucide-react";
import CallbackRequestModal from "@/components/contact/CallbackRequestModal";
import type {
  BoardListItem,
  CityListItem,
  CountryListItem,
  LocationListItem,
} from "@/lib/api";
import { toSeoSlug, type HomeSchoolCategory } from "@/lib/seo-slugs";
import { boardListingPath, placeListingPath, schoolDirectoryPath } from "@/lib/school-urls";
import { SITE_EMAIL, SITE_PHONE, SITE_PHONE_DISPLAY } from "@/lib/site";

type Props = {
  cities?: CityListItem[];
  boards?: BoardListItem[];
  countries?: CountryListItem[];
  locations?: LocationListItem[];
  dataError?: string | null;
  showCallbackDock?: boolean;
};

type Category = {
  key: "day-school" | "boarding-school" | "day-boarding-school";
  label: string;
  category: HomeSchoolCategory | "day-boarding-school";
  accent: string;
};

const CATEGORIES: Category[] = [
  { key: "day-school", label: "Day Schools", category: "day-school", accent: "#17456b" },
  { key: "boarding-school", label: "Boarding Schools", category: "residential-school", accent: "#e8650f" },
  { key: "day-boarding-school", label: "Day Boarding Schools", category: "day-boarding-school", accent: "#2e7d32" },
];

const TOP_STATE_LIMIT = 8;
const TOP_CITY_LIMIT = 8;

type StateGroup = {
  countrySlug: string;
  stateSlug: string;
  name: string;
  cities: CityListItem[];
};

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

function categoryHref(
  cat: Category,
  pathParts: { countrySlug: string; stateSlug?: string | null; citySlug?: string | null },
): string {
  return placeListingPath({
    countrySlug: pathParts.countrySlug,
    stateSlug: pathParts.stateSlug,
    citySlug: pathParts.citySlug,
    category: cat.category,
  });
}

export default function SiteFooterSeo({
  cities = [],
  boards = [],
  countries = [],
  dataError,
  showCallbackDock = true,
}: Props) {
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!showCallbackDock) setCallbackOpen(false);
  }, [showCallbackDock]);

  const togglePanel = (key: string) =>
    setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleState = (key: string) =>
    setOpenStates((prev) => ({ ...prev, [key]: !prev[key] }));

  const uniqueCities = useMemo(() => uniqueBy(cities, (city) => city.city_id), [cities]);

  // Group cities by state, sorted by total schools desc
  const stateGroups = useMemo<StateGroup[]>(() => {
    const map = new Map<string, StateGroup>();
    for (const city of uniqueCities) {
      if ((city.schools_count ?? 0) <= 0) continue;
      const countrySlug = city.country_slug ?? toSeoSlug(city.country_name);
      const stateSlug = city.state_slug ?? toSeoSlug(city.state_name);
      const key = `${countrySlug}/${stateSlug}`;
      const group = map.get(key) ?? {
        countrySlug,
        stateSlug,
        name: city.state_name,
        cities: [],
      };
      group.cities.push(city);
      map.set(key, group);
    }
    return [...map.values()]
      .sort((a, b) => {
        const aTotal = a.cities.reduce((s, c) => s + (c.schools_count ?? 0), 0);
        const bTotal = b.cities.reduce((s, c) => s + (c.schools_count ?? 0), 0);
        return bTotal - aTotal || a.name.localeCompare(b.name);
      })
      .map((g) => ({
        ...g,
        cities: [...g.cities].sort(
          (a, b) => (b.schools_count ?? 0) - (a.schools_count ?? 0) || a.city_name.localeCompare(b.city_name),
        ),
      }))
      .slice(0, TOP_STATE_LIMIT);
  }, [uniqueCities]);

  const popularCities = useMemo(
    () =>
      uniqueCities
        .filter((c) => (c.schools_count ?? 0) > 0)
        .sort((a, b) => (b.schools_count ?? 0) - (a.schools_count ?? 0))
        .slice(0, 12),
    [uniqueCities],
  );

  const topBoards = useMemo(
    () =>
      uniqueBy(boards, (board) => board.board_id)
        .filter((board) => board.status)
        .sort((left, right) => left.board_name.localeCompare(right.board_name)),
    [boards],
  );

  const india = countries.find((c) => toSeoSlug(c.slug || c.country_name) === "india");

  const renderStateCityPanel = (cat: Category) => (
    <div className="footer-accordion__sub">
      <div className="footer-state-list">
        {stateGroups.map((state) => {
          const stateKey = `${cat.key}-${state.stateSlug}`;
          const stateOpen = openStates[stateKey];
          return (
            <div key={stateKey} className="footer-state-item">
              <button
                type="button"
                className="footer-state-toggle"
                onClick={() => toggleState(stateKey)}
                aria-expanded={stateOpen}
              >
                <span>{state.name}</span>
                <ChevronDown size={14} className={`footer-chevron ${stateOpen ? "is-open" : ""}`} />
              </button>
              {stateOpen && (
                <ul className="footer-city-list">
                  {state.cities.slice(0, TOP_CITY_LIMIT).map((city) => (
                    <li key={city.city_id}>
                      <Link
                        href={categoryHref(
                          cat,
                          {
                            countrySlug: state.countrySlug,
                            stateSlug: state.stateSlug,
                            citySlug: city.slug,
                          },
                        )}
                      >
                        {city.city_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const panels = [
    ...CATEGORIES.map((cat) => ({
      key: cat.key,
      title: cat.label,
      accent: cat.accent,
      content: renderStateCityPanel(cat),
    })),
    {
      key: "boards",
      title: "Browse by Board",
      accent: "#17456b",
      content: (
        <div className="footer-accordion__sub">
          <ul className="footer-flat-list footer-flat-list--boards">
            {topBoards.map((board) => (
              <li key={board.board_id}>
                <Link href={boardListingPath(board.slug)}>{board.board_name}</Link>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      key: "popular-cities",
      title: "Popular Cities",
      accent: "#e8650f",
      content: (
        <div className="footer-accordion__sub">
          <ul className="footer-flat-list">
            {popularCities.map((city) => (
              <li key={city.city_id}>
                <Link
                  href={placeListingPath({
                    countrySlug: city.country_slug ?? city.country_name,
                    stateSlug: city.state_slug ?? city.state_name,
                    citySlug: city.slug,
                  })}
                >
                  {city.city_name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      key: "about",
      title: "About & Resources",
      accent: "#17456b",
      content: (
        <div className="footer-accordion__sub">
          <ul className="footer-flat-list">
            <li><Link href="/about/">About Us</Link></li>
            <li><Link href="/contact/">Contact Us</Link></li>
            <li><Link href="/counselling/">Counselling</Link></li>
            <li><Link href="/reviews/">Reviews</Link></li>
            <li><Link href="/compare/">Compare Schools</Link></li>
            <li><Link href={schoolDirectoryPath()}>All Schools</Link></li>
            <li><Link href="/privacy/">Privacy Policy</Link></li>
            <li><Link href="/terms/">Terms of Use</Link></li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <footer className="seo-footer seo-footer--directory" id="sitemap">
      {dataError && <p className="seo-footer__error" role="status">{dataError}</p>}

      {/* Brand strip */}
      <div className="footer-brand-strip">
        <div className="footer-brand-strip__inner">
          <div className="footer-brand">
            <img
              src="/BoardingEdu_LOGO.jpeg"
              alt="BoardingEdu"
              className="footer-brand__logo"
              width={120}
              height={40}
            />
            <p className="footer-brand__tagline">
              Connecting Parents & Schools Across India
            </p>
          </div>
          <div className="footer-contact">
            <a href={`tel:${SITE_PHONE}`} className="footer-contact__item">
              <Phone size={16} />
              <span>{SITE_PHONE_DISPLAY}</span>
            </a>
            <a href={`mailto:${SITE_EMAIL}`} className="footer-contact__item">
              <Mail size={16} />
              <span>{SITE_EMAIL}</span>
            </a>
            <div className="footer-contact__item">
              <MapPin size={16} />
              <span>{india ? "India" : "India"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion directory */}
      <nav className="footer-directory" aria-label="School directory and popular searches">
        <div className="footer-directory__grid">
          {panels.map((panel) => {
            const isOpen = openPanels[panel.key];
            return (
              <section key={panel.key} className="footer-accordion">
                <button
                  type="button"
                  className="footer-accordion__toggle"
                  onClick={() => togglePanel(panel.key)}
                  aria-expanded={isOpen}
                  style={{ borderColor: panel.accent }}
                >
                  <span className="footer-accordion__title">{panel.title}</span>
                  <ChevronDown
                    size={18}
                    className={`footer-accordion__chevron ${isOpen ? "is-open" : ""}`}
                    style={{ color: panel.accent }}
                  />
                </button>
                {isOpen && panel.content}
              </section>
            );
          })}
        </div>
      </nav>

      {/* Legal */}
      <div className="seo-footer__legal">
        <p>© 2026 BoardingEdu Technologies Pvt. Ltd. · All rights reserved.</p>
        <nav aria-label="Legal">
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
          <Link href="/about/">About</Link>
          <Link href="/contact/">Contact</Link>
        </nav>
      </div>

      {showCallbackDock && (
        <>
          <div className="callback-dock">
            <a className="callback-dock__phone" href={`tel:${SITE_PHONE}`} aria-label={`Call BoardingEdu at ${SITE_PHONE_DISPLAY}`}>
              <Phone size={18} />
            </a>
            <button type="button" className="callback-dock__action" onClick={() => setCallbackOpen(true)}>
              Request a Callback
            </button>
          </div>
          <CallbackRequestModal isOpen={callbackOpen} onClose={() => setCallbackOpen(false)} />
        </>
      )}
    </footer>
  );
}
