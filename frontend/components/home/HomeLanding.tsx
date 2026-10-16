"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import type { BoardListItem, SchoolListItem, SchoolTypeListItem } from "@/lib/api";
import {
  exploreItems,
  howItWorksSteps,
  whyUsCards,
  faqItems,
} from "@/lib/home-content";
import SeoPlaceMarquee, { type SeoPlace } from "@/components/home/SeoPlaceMarquee";
import FeaturedSchoolCards from "@/components/home/FeaturedSchoolCards";
import CounsellingSection from "@/components/home/CounsellingSection";
import SiteFooterSeo from "@/components/home/SiteFooterSeo";
import { useMemo, useState } from "react";

type Props = {
  boards: BoardListItem[];
  schoolTypes: SchoolTypeListItem[];
  featuredSchools: SchoolListItem[];
  featuredLoading: boolean;
  featuredError: string | null;
  directorySchools: SchoolListItem[];
  onExplore: (query: (typeof exploreItems)[number]["query"]) => void;
  onPlaceSearch: (label: string) => void;
};

export default function HomeLanding({
  boards,
  schoolTypes,
  featuredSchools,
  featuredLoading,
  featuredError,
  directorySchools,
  onExplore,
  onPlaceSearch,
}: Props) {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const places = useMemo(() => {
    const cityCounts = new Map<string, number>();
    const stateCounts = new Map<string, number>();
    for (const school of [...featuredSchools, ...directorySchools]) {
      if (school.city_name) {
        cityCounts.set(school.city_name, (cityCounts.get(school.city_name) ?? 0) + 1);
      }
      if (school.state_name) {
        stateCounts.set(school.state_name, (stateCounts.get(school.state_name) ?? 0) + 1);
      }
    }
    const rankedCities = [...cityCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label);
    const rankedStates = [...stateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label);

    const merged: SeoPlace[] = [];
    const max = Math.max(rankedCities.length, rankedStates.length);
    for (let index = 0; index < max; index += 1) {
      if (rankedCities[index]) {
        merged.push({
          key: `city-${rankedCities[index]}`,
          label: rankedCities[index],
          kind: "city",
        });
      }
      if (rankedStates[index]) {
        merged.push({
          key: `state-${rankedStates[index]}`,
          label: rankedStates[index],
          kind: "state",
        });
      }
    }
    return merged;
  }, [directorySchools, featuredSchools]);

  void boards;
  void schoolTypes;

  return (
    <>
      <section className="home-section explore-section" id="explore">
        <div className="home-section__heading home-section__heading--centered">
          <div>
            <div className="section-eyebrow">EXPLORE</div>
            <h2>Find What You&apos;re Looking For</h2>
          </div>
        </div>
        <div className="explore-grid">
          {exploreItems.map((item) =>
            item.query ? (
              <button
                type="button"
                className="explore-tile"
                key={item.title}
                onClick={() => onExplore(item.query)}
              >
                <span>{item.emoji}</span>
                {item.title}
              </button>
            ) : (
              <Link className="explore-tile" key={item.title} href={item.href}>
                <span>{item.emoji}</span>
                {item.title}
              </Link>
            )
          )}
        </div>
      </section>

      <section className="home-section process-section" id="how-it-works">
        <div className="home-section__heading home-section__heading--centered">
          <div>
            <div className="section-eyebrow">SIMPLE PROCESS</div>
            <h2>How BoardingEdu Works</h2>
            <p className="home-lead">
              From first search to confirmed admission — a streamlined journey built entirely for
              parents.
            </p>
          </div>
        </div>
        <div className="process-grid">
          {howItWorksSteps.map((step, index) => (
            <article key={step.title}>
              <span>0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section--cities" id="cities">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">FIND YOUR PLACE</div>
            <h2>Explore top cities and top states</h2>
          </div>
          <Link href="/schools">
            View all schools <ArrowRight size={15} />
          </Link>
        </div>
        <SeoPlaceMarquee places={places} onSelect={(place) => onPlaceSearch(place.label)} />
      </section>

      <section className="home-section home-section--featured" id="featured">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">FEATURED SCHOOLS</div>
            <h2>Featured Schools</h2>
          </div>
          <Link href="/schools">
            View All Schools <ArrowRight size={15} />
          </Link>
        </div>
        {featuredLoading ? (
          <div className="featured-state" role="status">
            <LoaderCircle className="spin" size={20} />
            Loading schools…
          </div>
        ) : featuredError ? (
          <div className="featured-state featured-state--error" role="alert">
            {featuredError}
          </div>
        ) : featuredSchools.length > 0 ? (
          <FeaturedSchoolCards schools={featuredSchools} />
        ) : (
          <p className="section-empty">
            Featured schools will appear here when the directory has published listings.
          </p>
        )}
      </section>

      <section className="home-section why-us" id="why-us">
        <div className="home-section__heading home-section__heading--centered">
          <div>
            <div className="section-eyebrow">WHY US</div>
            <h2>Why Parents Across Globally Trust BoardingEdu</h2>
            <p className="home-lead">
              A unique blend of verified data, technology, and personalised human support — making
              us World&apos;s most trusted platform.
            </p>
          </div>
        </div>
        <div className="why-grid">
          {whyUsCards.map((card) => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <CounsellingSection />

      <section className="home-section home-section--faq" id="faq">
        <div className="home-section__heading home-section__heading--centered">
          <div>
            <div className="section-eyebrow">FAQ</div>
            <h2>Questions parents search for</h2>
          </div>
        </div>
        <div className="faq-list">
          {faqItems.map((item, index) => {
            const open = activeFaq === index;
            return (
              <div className={`faq-item ${open ? "faq-item--open" : ""}`} key={item.question}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setActiveFaq(open ? null : index)}
                >
                  <span>{item.question}</span>
                  <span className="faq-toggle">{open ? "−" : "+"}</span>
                </button>
                {open && <p className="faq-answer">{item.answer}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="home-section home-section--school-cta" id="for-schools">
        <div className="school-cta">
          <div>
            <div className="section-eyebrow section-eyebrow--light">FOR SCHOOLS</div>
            <h2>Are You a School?</h2>
            <p>
              Showcase your school, connect with parents, and manage admission enquiries through
              BoardingEdu.
            </p>
          </div>
          <div className="school-cta__actions">
            <Link href="/signup" className="primary-button">
              List Your School
            </Link>
            <Link href="/schools" className="secondary-button">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      <SiteFooterSeo />
    </>
  );
}
