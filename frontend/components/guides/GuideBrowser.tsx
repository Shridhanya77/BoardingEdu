"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GuideSummary } from "@/lib/api";

export default function GuideBrowser({
  guides,
  compact = false,
  featuredSlug,
}: {
  guides: GuideSummary[];
  compact?: boolean;
  featuredSlug?: string;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const categories = useMemo(
    () => [...new Set(guides.map((guide) => guide.category))].sort(),
    [guides],
  );
  const visibleGuides = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guides.filter((guide) =>
      guide.slug !== featuredSlug &&
      (!category || guide.category === category) &&
      (!needle || `${guide.title} ${guide.summary} ${guide.category}`.toLowerCase().includes(needle)),
    );
  }, [category, featuredSlug, guides, query]);
  const [visibleCount, setVisibleCount] = useState(compact ? 3 : 6);

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
          {visibleGuides.slice(0, visibleCount).map((guide) => (
            <article key={guide.slug} className="guide-browser__card">
              <span
                className={`guide-browser__art guide-browser__art--${guide.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                aria-hidden="true"
              >
                <Image
                  src={guide.coverImageUrl || "/guide-family.svg"}
                  alt=""
                  fill
                  sizes="(max-width: 700px) 90vw, 360px"
                  unoptimized
                />
              </span>
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
      {visibleGuides.length > visibleCount && (
        <button
          className="guide-browser__load-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + (compact ? 3 : 6))}
        >
          Load more guides
        </button>
      )}
    </section>
  );
}
