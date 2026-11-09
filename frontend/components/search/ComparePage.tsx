"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Bus,
  BookOpen,
  Building2,
  Dumbbell,
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { schools, type SchoolDetail, type SchoolListItem } from "@/lib/api";
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
  const [activeGroup, setActiveGroup] = useState("overview");
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [schoolDetails, setSchoolDetails] = useState<Record<string, {
    loading?: boolean;
    facilities?: SchoolDetail["facilities_detail"];
    error?: string;
  }>>({});

  useEffect(() => {
    let cancelled = false;
    if (!comparedSchools.length) {
      setSchoolDetails({});
      return;
    }

    setSchoolDetails(
      Object.fromEntries(comparedSchools.map((school) => [school.school_id, { loading: true }])),
    );
    Promise.all(comparedSchools.map(async (school) => {
      try {
        const detail = await schools.bySlug(school.slug);
        return [school.school_id, { facilities: detail.facilities_detail }] as const;
      } catch (reason) {
        return [
          school.school_id,
          {
            error: reason instanceof Error
              ? reason.message
              : "School facilities could not be loaded.",
          },
        ] as const;
      }
    })).then((entries) => {
      if (!cancelled) setSchoolDetails(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [comparedSchools]);

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
    description: string;
    icon: typeof BookOpen;
    rows: {
      label: string;
      value: (school: (typeof comparedSchools)[number]) => string;
      score?: (school: (typeof comparedSchools)[number]) => number | null;
      prefer?: "low" | "high";
    }[];
  }[] = [
    {
      id: "overview",
      label: "Overview",
      description: "Core details to understand each school",
      icon: Building2,
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
          label: "Location",
          value: (school) => [school.city_name, school.state_name].filter(Boolean).join(", ") || "Not listed",
        },
        {
          label: "Student community",
          value: (school) => school.gender || "Not listed",
        },
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
      ],
    },
    {
      id: "fees",
      label: "Fees Structure",
      description: "Compare published annual tuition fees",
      icon: Wallet,
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
      id: "academics",
      label: "Academics",
      description: "Curriculum and academic performance",
      icon: BookOpen,
      rows: [
        {
          label: "Academics rating",
          value: (school) => school.academics_rating == null ? "No parent ratings yet" : `${school.academics_rating.toFixed(1)} / 5`,
          score: (school) => school.academics_rating ?? null,
          prefer: "high",
        },
      ],
    },
    {
      id: "facilities",
      label: "Facilities",
      description: "Facilities rating and amenities listed by each school",
      icon: Building2,
      rows: [
        {
          label: "Facilities rating",
          value: (school) => school.facilities_rating == null ? "No parent ratings yet" : `${school.facilities_rating.toFixed(1)} / 5`,
          score: (school) => school.facilities_rating ?? null,
          prefer: "high",
        },
        {
          label: "Facilities listed",
          value: (school) => {
            const details = schoolDetails[school.school_id];
            if (!details) return "Loading school details…";
            if (details.loading) return "Loading school details…";
            if (details.error) return "Facilities could not be loaded";
            const facilities = details.facilities ?? [];
            return facilities
              .filter((facility) => !/sport|transport|bus|vehicle/i.test(facility.facility_name))
              .map((facility) => facility.facility_name)
              .join(", ") || "Not listed";
          },
        },
      ],
    },
    {
      id: "sports",
      label: "Sports & Activities",
      description: "Sports and activity facilities listed by each school",
      icon: Dumbbell,
      rows: [
        {
          label: "Sports & activities",
          value: (school) => {
            const details = schoolDetails[school.school_id];
            if (!details) return "Loading school details…";
            if (details.loading) return "Loading school details…";
            if (details.error) return "Facilities could not be loaded";
            const facilities = details.facilities ?? [];
            return facilities
              .filter((facility) =>
                !/transport|bus|vehicle/i.test(facility.facility_name) &&
                /sport|playground|gym|swimming|activity|arts|music/i.test(facility.facility_name),
              )
              .map((facility) => facility.facility_name)
              .join(", ") || "Not listed";
          },
        },
      ],
    },
    {
      id: "transport",
      label: "Transport",
      description: "School transport facilities listed by each school",
      icon: Bus,
      rows: [
        {
          label: "Transport",
          value: (school) => {
            const details = schoolDetails[school.school_id];
            if (!details) return "Loading school details…";
            if (details.loading) return "Loading school details…";
            if (details.error) return "Facilities could not be loaded";
            const facilities = details.facilities ?? [];
            return facilities
              .filter((facility) => /transport|bus|vehicle|pick.?up/i.test(facility.facility_name))
              .map((facility) => facility.facility_name)
              .join(", ") || "Not listed";
          },
        },
      ],
    },
    {
      id: "safety",
      label: "Safety & Security",
      description: "Published parent feedback about safety",
      icon: ShieldCheck,
      rows: [
        {
          label: "Safety rating",
          value: (school) => school.safety_rating == null ? "No parent ratings yet" : `${school.safety_rating.toFixed(1)} / 5`,
          score: (school) => school.safety_rating ?? null,
          prefer: "high",
        },
      ],
    },
    {
      id: "parent-feedback",
      label: "Parent Feedback",
      description: "Overall experience and communication ratings",
      icon: Star,
      rows: [
        {
          label: "Communication rating",
          value: (school) => school.communication_rating == null ? "No parent ratings yet" : `${school.communication_rating.toFixed(1)} / 5`,
          score: (school) => school.communication_rating ?? null,
          prefer: "high",
        },
      ],
    },
  ];

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

  const activeComparisonGroup = groups.find((group) => group.id === activeGroup) ?? groups[0]!;
  const activeRows = activeComparisonGroup.rows.filter((row) => {
    if (!differencesOnly || comparedSchools.length < 2) return true;
    const values = comparedSchools.map((school) => row.value(school));
    return new Set(values).size > 1;
  });
  const ActiveGroupIcon = activeComparisonGroup.icon;

  return (
    <main className="compare-page compare-page--studio">
      <Link className="school-detail__back" href="/schools">
        <ArrowLeft size={15} /> Back to school search
      </Link>
      <div className="compare-page__heading compare-page__heading--center">
        <div>
          <div className="section-eyebrow">SCHOOL COMPARISON WORKSPACE</div>
          <h1>Find the right fit, side by side.</h1>
          <p>Build a shortlist and explore the details that matter most to your family.</p>
          <div className="compare-page__trust">
            <span><Building2 size={17} aria-hidden /> Compare up to four schools</span>
            <span><ShieldCheck size={17} aria-hidden /> Based on published details</span>
          </div>
        </div>
        {comparedSchools.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearSchools();
              setQuery("");
              setSelectionMessage(null);
            }}
          >
            Clear comparison
          </button>
        )}
      </div>

      {storageError && <p role="alert">{storageError}</p>}
      <section className="compare-builder" aria-labelledby="compare-builder-heading">
        <div className="compare-builder__search">
          <div className="compare-builder__intro">
            <span className="compare-builder__step">BUILD A SHORTLIST</span>
            <h2 id="compare-builder-heading">Add schools to compare</h2>
            <p>Search by school name, then add up to four options.</p>
          </div>
          <div className="compare-school-picker" aria-label="Search for a school to compare">
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
                placeholder="Start typing a school name..."
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
                  const atLimit = comparedSchools.length >= 4;
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
                        disabled={selected || atLimit}
                        onClick={() => {
                          if (selected || atLimit) return;
                          toggleSchool(school);
                          setSelectionMessage(`${school.school_name} added to your comparison.`);
                          setQuery("");
                          setSearchResults([]);
                        }}
                      >
                        {selected ? "Added" : atLimit ? "Limit reached" : <><Plus size={15} /> Add</>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {query.trim().length < 2 && (
              <p className="compare-school-picker__hint">Enter at least two characters to find a school.</p>
            )}
          </div>
        </div>
        <div className="compare-builder__shortlist">
          <div className="compare-builder__shortlist-heading">
            <span>YOUR SHORTLIST</span>
            <strong>{comparedSchools.length}<small> / 4</small></strong>
          </div>
          {comparedSchools.length ? (
            <ul className="compare-selected-list">
              {comparedSchools.map((school, index) => {
                const image = publicSchoolImageUrl(school.school_image_url || school.school_logo_url);
                return (
                  <li className="compare-selected-school" key={school.school_id}>
                    <span className="compare-selected-school__index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="compare-selected-school__photo">
                      {image ? (
                        <Image src={image} alt="" width={42} height={42} unoptimized />
                      ) : (
                        <GraduationCap size={20} aria-hidden />
                      )}
                    </span>
                    <span className="compare-selected-school__details">
                      <strong>{school.school_name}</strong>
                      <small>{[school.city_name, school.state_name].filter(Boolean).join(", ")}</small>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSchool(school.school_id)}
                      aria-label={`Remove ${school.school_name} from comparison`}
                    >
                      <X size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="compare-builder__empty">Your shortlist is empty. Search for a school to get started.</p>
          )}
        </div>
      </section>

      <header className="compare-section-heading compare-section-heading--categories">
        <span>EXPLORE THE DETAILS</span>
        <h2>Choose what matters to you</h2>
      </header>

      <nav className="compare-category-nav" aria-label="Comparison categories">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <button
              className={activeGroup === group.id ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={activeGroup === group.id}
              key={group.id}
              onClick={() => setActiveGroup(group.id)}
            >
              <GroupIcon size={17} aria-hidden />
              <span>{group.label}</span>
              <small>{group.rows.length}</small>
            </button>
          );
        })}
      </nav>

      <section
        className="compare-category-panel"
        role="tabpanel"
        aria-label={`${activeComparisonGroup.label} comparison`}
        style={{ ["--compare-cols" as string]: Math.max(comparedSchools.length, 1) }}
      >
        <div className="compare-category-panel__heading">
          <div className="compare-category-panel__title">
            <span className="compare-category-panel__icon"><ActiveGroupIcon size={21} aria-hidden /></span>
            <div>
              <span className="compare-category-panel__eyebrow">CATEGORY {String(groups.findIndex((group) => group.id === activeGroup) + 1).padStart(2, "0")}</span>
              <h3>{activeComparisonGroup.label}</h3>
              <p>{activeComparisonGroup.description}</p>
            </div>
          </div>
          <label className="compare-diff">
            <input
              type="checkbox"
              checked={differencesOnly}
              onChange={(event) => setDifferencesOnly(event.target.checked)}
            />
            Differences only
          </label>
        </div>

        {comparedSchools.length === 0 ? (
          <div className="compare-category-panel__empty">
            <span><Search size={22} aria-hidden /></span>
            <strong>Your comparison starts with a school.</strong>
            <p>Search above to add schools and see their {activeComparisonGroup.label.toLowerCase()} details side by side.</p>
          </div>
        ) : (
          <>
            <div className="compare-matrix__schools">
              <div className="compare-matrix__label">SCHOOL</div>
              {comparedSchools.map((school, index) => {
                const image = publicSchoolImageUrl(school.school_image_url || school.school_logo_url);
                return (
                  <article className="compare-matrix__school" key={school.school_id}>
                    <span className="compare-matrix__index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="compare-matrix__photo">
                      {image ? <Image src={image} alt="" width={48} height={48} unoptimized /> : <GraduationCap size={22} aria-hidden />}
                    </span>
                    <span className="compare-matrix__school-info">
                      <strong>{school.school_name}</strong>
                      <small>{[school.city_name, school.state_name].filter(Boolean).join(", ")}</small>
                      <Link
                        href={schoolProfilePathFromSlugs({
                          countrySlug: school.country_slug,
                          stateSlug: school.state_slug,
                          citySlug: school.city_slug,
                          localitySlug: school.location_slug,
                          schoolSlug: school.slug,
                          schoolName: school.school_name,
                          schoolTypes: school.school_types_detail,
                        })}
                      >
                        View profile
                      </Link>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSchool(school.school_id)}
                      aria-label={`Remove ${school.school_name} from comparison`}
                    >
                      <X size={15} />
                    </button>
                  </article>
                );
              })}
            </div>

            {comparedSchools.length < 2 && (
              <p className="compare-category-panel__hint">Add another school to unlock the side-by-side comparison.</p>
            )}

            <div className="compare-matrix">
              {activeRows.length ? activeRows.map((row) => {
                const winner = winningIndex(row);
                return (
                  <div className="compare-matrix__row" key={row.label}>
                    <div className="compare-matrix__label">{row.label}</div>
                    {comparedSchools.map((school, index) => (
                      <div
                        className={index === winner ? "compare-matrix__value is-best" : "compare-matrix__value"}
                        key={school.school_id}
                      >
                        <span>{row.value(school)}</span>
                        {index === winner && <em>{row.prefer === "low" ? "Lower fee" : "Higher rating"}</em>}
                      </div>
                    ))}
                  </div>
                );
              }) : (
                <p className="compare-category-panel__empty-state">No differences found in this category.</p>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
