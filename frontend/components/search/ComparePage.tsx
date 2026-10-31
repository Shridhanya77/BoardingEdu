"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Plus, Search, X } from "lucide-react";
import { schools, type SchoolListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";
import { useSearchExperience } from "@/lib/search-experience";
import { schoolTypeLabel } from "@/lib/seo-slugs";
import { publicSchoolImageUrl } from "@/lib/school-media";
import { boardsAffiliatedLabel } from "@/lib/board-labels";

export default function ComparePage() {
  const {
    comparedSchools,
    hydrated,
    removeSchool,
    clearSchools,
    storageError,
    toggleSchool,
  } = useSearchExperience();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState("all");
  const [differencesOnly, setDifferencesOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const search = query.trim();
    if (search.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);
      schools.list({ search, page_size: 8 })
        .then((response) => {
          if (!cancelled) setSearchResults(response.results);
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setSearchResults([]);
          setSearchError(
            reason instanceof Error ? reason.message : "School search could not be completed.",
          );
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  if (!hydrated) {
    return <main className="compare-page" aria-busy="true">Loading comparison…</main>;
  }

  const groups: {
    id: string;
    label: string;
    rows: {
      label: string;
      value: (school: (typeof comparedSchools)[number]) => string;
      score?: (school: (typeof comparedSchools)[number]) => number | null;
      prefer?: "low" | "high";
    }[];
  }[] = [
    {
      id: "academics",
      label: "Academics",
      rows: [
        {
          label: "Education board",
          value: (school) => boardsAffiliatedLabel(school.boards_detail) || "Not listed",
        },
        {
          label: "School type",
          value: (school) =>
            school.school_types_detail.map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name)).join(", ") || "Not listed",
        },
        {
          label: "Classes offered",
          value: (school) => school.grades_range || "Not listed",
        },
        {
          label: "Academics rating",
          value: (school) => school.academics_rating == null ? "No parent ratings yet" : `${school.academics_rating.toFixed(1)} / 5`,
          score: (school) => school.academics_rating ?? null,
          prefer: "high",
        },
      ],
    },
    {
      id: "fees",
      label: "Fees",
      rows: [
        {
          label: "Annual fees",
          value: (school) =>
            school.annual_fee == null
              ? "Not published"
              : `₹${new Intl.NumberFormat("en-IN").format(Number(school.annual_fee))}`,
          score: (school) => {
            const amount = Number(school.annual_fee);
            return Number.isFinite(amount) && amount > 0 ? amount : null;
          },
          prefer: "low",
        },
      ],
    },
    {
      id: "campus",
      label: "Campus",
      rows: [
        {
          label: "Location",
          value: (school) => [school.city_name, school.state_name].filter(Boolean).join(", ") || "Not listed",
        },
        {
          label: "Student community",
          value: (school) => school.gender || "Not listed",
        },
        {
          label: "Facilities rating",
          value: (school) => school.facilities_rating == null ? "No parent ratings yet" : `${school.facilities_rating.toFixed(1)} / 5`,
          score: (school) => school.facilities_rating ?? null,
          prefer: "high",
        },
        {
          label: "Safety rating",
          value: (school) => school.safety_rating == null ? "No parent ratings yet" : `${school.safety_rating.toFixed(1)} / 5`,
          score: (school) => school.safety_rating ?? null,
          prefer: "high",
        },
      ],
    },
    {
      id: "admission",
      label: "Admission",
      rows: [
        {
          label: "Admission status",
          value: (school) =>
            school.admission_open === undefined
              ? "Ask the school"
              : school.admission_open
                ? "Admissions open"
                : "Admissions closed",
        },
        {
          label: "Established",
          value: (school) => school.established_year?.toString() ?? "Not listed",
        },
        {
          label: "Parent rating",
          value: (school) =>
            school.average_rating == null ? "No parent ratings yet" : `${school.average_rating.toFixed(1)} / 5 · ${school.review_count} reviews`,
          score: (school) => school.average_rating,
          prefer: "high",
        },
        {
          label: "Communication rating",
          value: (school) => school.communication_rating == null ? "No parent ratings yet" : `${school.communication_rating.toFixed(1)} / 5`,
          score: (school) => school.communication_rating ?? null,
          prefer: "high",
        },
      ],
    },
  ];

  const visibleGroups = groups.filter((group) => activeGroup === "all" || group.id === activeGroup);

  function winningIndex(row: (typeof groups)[number]["rows"][number]) {
    if (!row.score || !row.prefer || comparedSchools.length < 2) return -1;
    const scored = comparedSchools.map((school, index) => ({ index, score: row.score!(school) }));
    const present = scored.filter((item): item is { index: number; score: number } => item.score != null);
    if (present.length < 2) return -1;
    const target = row.prefer === "low"
      ? Math.min(...present.map((item) => item.score))
      : Math.max(...present.map((item) => item.score));
    const winners = present.filter((item) => item.score === target);
    return winners.length === 1 ? winners[0].index : -1;
  }

  return (
    <main className="compare-page compare-page--studio">
      <Link className="school-detail__back" href="/schools">
        <ArrowLeft size={15} /> Back to school search
      </Link>
      <div className="compare-page__heading">
        <div>
          <div className="section-eyebrow">MAKE AN INFORMED CHOICE</div>
          <h1>Compare schools</h1>
          <p>
            {comparedSchools.length < 2
              ? "Choose another school to compare side by side. Missing details are shown as not listed rather than estimated."
              : "Review published school details, parent ratings, and fees side by side. Missing information is clearly labeled."}
          </p>
        </div>
        {comparedSchools.length > 0 && (
          <button type="button" onClick={clearSchools}>
            Clear comparison
          </button>
        )}
      </div>

      {storageError && <p role="alert">{storageError}</p>}
      {comparedSchools.length < 4 && (
        <section className="compare-school-picker" aria-label="Add a school to compare">
          <label htmlFor="compare-school-search">
            <Search size={17} aria-hidden />
            <span className="sr-only">Search for a school to compare</span>
            <input
              id="compare-school-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectionMessage(null);
              }}
              placeholder="Enter another school name"
              autoComplete="off"
            />
          </label>
          {selectionMessage && <p role="status">{selectionMessage}</p>}
          {searchError && <p role="alert">{searchError}</p>}
          {searchLoading && <p role="status">Searching schools…</p>}
          {!searchLoading && query.trim().length >= 2 && !searchError && searchResults.length === 0 && (
            <p role="status">No matching schools found.</p>
          )}
          {searchResults.length > 0 && (
            <ul className="compare-school-picker__results">
              {searchResults.map((school) => {
                const selected = comparedSchools.some((item) => item.school_id === school.school_id);
                return (
                  <li key={school.school_id}>
                    <span className="compare-school-picker__image">
                      {publicSchoolImageUrl(school.school_image_url || school.school_logo_url) ? (
                        <Image
                          src={publicSchoolImageUrl(school.school_image_url || school.school_logo_url)}
                          alt=""
                          width={48}
                          height={48}
                          unoptimized
                        />
                      ) : (
                        <GraduationCap size={20} aria-hidden />
                      )}
                    </span>
                    <span className="compare-school-picker__details">
                      <strong>{school.school_name}</strong>
                      <small>{[school.city_name, school.state_name].filter(Boolean).join(", ")}</small>
                    </span>
                    <button
                      type="button"
                      disabled={selected}
                      onClick={() => {
                        if (selected) return;
                        if (comparedSchools.length >= 4) {
                          setSelectionMessage("You can compare up to four schools at a time.");
                          return;
                        }
                        toggleSchool(school);
                        setSelectionMessage(`${school.school_name} added to comparison.`);
                      }}
                    >
                      {selected ? "Added" : <><Plus size={15} /> Add</>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {query.trim().length < 2 && (
            <p className="compare-school-picker__hint">Enter at least two characters to search the school directory.</p>
          )}
        </section>
      )}

      <header className="compare-section-heading">
        <span>Side-by-side overview</span>
        <h2>Comparison of schools</h2>
      </header>

      {comparedSchools.length === 0 ? (
        <section className="compare-empty">
          <h2>No schools selected yet</h2>
          <p>Select at least two schools to compare fees, boards, ratings and admissions side by side.</p>
          <Link href="/schools/">Browse schools</Link>
        </section>
      ) : (
        <section className="compare-board" style={{ ["--compare-cols" as string]: comparedSchools.length }}>
          <div className="compare-board__tools">
            <div className="compare-tabs" role="tablist" aria-label="Comparison groups">
              {[{ id: "all", label: "All details" }, ...groups.map(({ id, label }) => ({ id, label }))].map((group) => (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={activeGroup === group.id}
                  className={activeGroup === group.id ? "is-active" : ""}
                  onClick={() => setActiveGroup(group.id)}
                >
                  {group.label}
                </button>
              ))}
            </div>
            <label className="compare-diff">
              <input
                type="checkbox"
                checked={differencesOnly}
                onChange={(event) => setDifferencesOnly(event.target.checked)}
              />
              Show differences only
            </label>
          </div>

          <div className="compare-board__heads">
            <div className="compare-board__corner">School</div>
            {comparedSchools.map((school) => (
              <article className="compare-school-card" key={school.school_id}>
                <span className="compare-school-card__photo">
                  {publicSchoolImageUrl(school.school_image_url || school.school_logo_url) ? (
                    <Image
                      src={publicSchoolImageUrl(school.school_image_url || school.school_logo_url)}
                      alt=""
                      fill
                      sizes="220px"
                      unoptimized
                    />
                  ) : (
                    <GraduationCap size={22} aria-hidden />
                  )}
                </span>
                <div>
                  <strong>{school.school_name}</strong>
                  <small>{[school.city_name, school.state_name].filter(Boolean).join(", ")}</small>
                </div>
                <div className="compare-school-card__actions">
                  <Link
                    href={schoolProfilePathFromSlugs({
                      countrySlug: school.country_slug,
                      stateSlug: school.state_slug,
                      citySlug: school.city_slug,
                      localitySlug: school.location_slug,
                      schoolSlug: school.slug,
                      schoolName: school.school_name,
                    })}
                  >
                    View profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeSchool(school.school_id)}
                    aria-label={`Remove ${school.school_name} from comparison`}
                  >
                    <X size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {comparedSchools.length < 2 && (
            <p className="compare-board__hint">Add one more school to see them side by side.</p>
          )}

          <div className="compare-groups" key={`${activeGroup}-${differencesOnly}`}>
            {visibleGroups.map((group) => {
              const rows = group.rows.filter((row) => {
                if (!differencesOnly || comparedSchools.length < 2) return true;
                const values = comparedSchools.map((school) => row.value(school));
                return new Set(values).size > 1;
              });
              if (!rows.length) return null;
              return (
                <section className="compare-group" key={group.id}>
                  <h2>{group.label}</h2>
                  {rows.map((row) => {
                    const winner = winningIndex(row);
                    return (
                      <div className="compare-row" key={row.label}>
                        <div className="compare-row__label">{row.label}</div>
                        {comparedSchools.map((school, index) => (
                          <div
                            className={index === winner ? "compare-cell is-best" : "compare-cell"}
                            key={school.school_id}
                          >
                            {row.value(school)}
                            {index === winner && <em>{row.prefer === "low" ? "Lower fee" : "Higher rating"}</em>}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
