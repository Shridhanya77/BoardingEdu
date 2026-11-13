"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GuideCategory, GuideSummary } from "@/lib/guides";

const categories: GuideCategory[] = [
  "Admissions",
  "Boarding Life",
  "Boards & Curriculum",
  "Fees & Planning",
];

export default function GuideBrowser({
  guides,
  compact = false,
}: {
  guides: GuideSummary[];
  compact?: boolean;
}) {
  const [category, setCategory] = useState<GuideCategory | null>(null);
  const [query, setQuery] = useState("");
  const visibleGuides = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guides.filter((guide) =>
      (!category || guide.category === category) &&
      (!needle || `${guide.title} ${guide.summary} ${guide.category}`.toLowerCase().includes(needle)),
    );
  }, [category, guides, query]);

  return (
    <section className={`guide-browser${compact ? " guide-browser--compact" : ""}`} aria-labelledby="guide-browser-title">
      <div className="guide-browser__heading">
        <div>
          <span className="section-eyebrow">PARENT GUIDES</span>
          <h2 id="guide-browser-title">Helpful advice for your school search</h2>
          <p>Explore practical guides on admissions, fees, curriculum, and boarding life.</p>
        </div>
        <label className="guide-browser__search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search school guides</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides"
          />
        </label>
      </div>

      <div className="guide-browser__filters" role="group" aria-label="Filter guides by topic">
        <button type="button" className={!category ? "is-active" : ""} aria-pressed={!category} onClick={() => setCategory(null)}>
          All topics
        </button>
        {categories.map((item) => (
          <button
            type="button"
            className={category === item ? "is-active" : ""}
            aria-pressed={category === item}
            key={item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {visibleGuides.length ? (
        <div className="guide-browser__grid" aria-live="polite">
          {visibleGuides.map((guide) => (
            <article key={guide.slug} className="guide-browser__card">
              <span className="guide-browser__tag">{guide.category}</span>
              <h3><Link href={`/guides/${guide.slug}`}>{guide.title}</Link></h3>
              <p>{guide.summary}</p>
              <div className="guide-browser__meta">
                <span>{guide.readingMinutes} min read</span>
                <Link href={`/guides/${guide.slug}`}>Read guide <span aria-hidden>→</span></Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="guide-browser__empty" role="status">No guides match your search. Try another topic or keyword.</p>
      )}
    </section>
  );
}
