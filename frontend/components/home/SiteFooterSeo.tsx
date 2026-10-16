"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BoardListItem, CityListItem } from "@/lib/api";
import { toSeoSlug } from "@/lib/seo-slugs";

type Props = {
  cities?: CityListItem[];
  boards?: BoardListItem[];
};

const schoolSearchTypes = [
  { label: "Boarding Schools", slug: "boarding-school" },
  { label: "Day Schools", slug: "day-school" },
  { label: "Full Boarding", slug: "full-boarding-school" },
];

export default function SiteFooterSeo({ cities = [], boards = [] }: Props) {
  const [activeType, setActiveType] = useState(schoolSearchTypes[0]!.slug);
  const popularCities = cities.slice(0, 16);
  const stateSearches = useMemo(() => {
    const totals = new Map<string, { countrySlug: string; stateSlug: string; name: string; count: number }>();
    for (const city of cities) {
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
      .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
      .slice(0, 16);
  }, [cities]);

  return (
    <footer className="seo-footer" id="sitemap">
      <section className="seo-footer__popular" aria-labelledby="popular-searches-heading">
        <div className="seo-footer__popular-heading">
          <h2 id="popular-searches-heading">Popular school searches</h2>
          <div className="seo-footer__tabs" role="group" aria-label="Popular school search type">
            {schoolSearchTypes.map((type) => (
              <button
                type="button"
                key={type.slug}
                className={activeType === type.slug ? "is-active" : ""}
                aria-pressed={activeType === type.slug}
                onClick={() => setActiveType(type.slug)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
        <div className="seo-footer__search-groups">
          <section>
            <h3>By city</h3>
            {popularCities.map((city) => (
              <Link
                key={city.city_id}
                href={`/${city.country_slug ?? toSeoSlug(city.country_name)}/${city.state_slug ?? toSeoSlug(city.state_name)}/${city.slug}`}
              >
                {`Schools in ${city.city_name}`}
              </Link>
            ))}
          </section>
          <section>
            <h3>By state</h3>
            {stateSearches.map(([key, state]) => (
              <Link key={key} href={`/${state.countrySlug}/${state.stateSlug}?type=${activeType}`}>
                {`${schoolSearchTypes.find((type) => type.slug === activeType)?.label ?? "Schools"} in ${state.name}`}
              </Link>
            ))}
          </section>
          <section>
            <h3>By education board</h3>
            {boards.slice(0, 16).map((board) => (
              <Link key={board.board_id} href={`/schools?board=${encodeURIComponent(board.board_id)}`}>
                {`${board.board_name} schools in India`}
              </Link>
            ))}
            <Link href="/india?type=boarding-school">Schools across India</Link>
          </section>
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
          <Link href="/#blog">School admission guides</Link>
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
          <Link href="/#blog">School guides</Link>
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
