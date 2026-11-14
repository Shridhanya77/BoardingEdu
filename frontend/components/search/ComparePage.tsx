"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  dashboards,
  schools,
  type SchoolDetail,
  type SchoolListItem,
} from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";
import { useSearchExperience } from "@/lib/search-experience";
import { schoolTypeLabel } from "@/lib/seo-slugs";
import { publicSchoolImageUrl } from "@/lib/school-media";
import { boardsAffiliatedLabel } from "@/lib/board-labels";

export default function ComparePage({
  shortlistOnly = false,
}: {
  shortlistOnly?: boolean;
}) {
  const {
    comparedSchools,
    hydrated,
    removeSchool,
    clearSchools,
    assignSchoolToSlot,
    storageError,
  } = useSearchExperience();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [activeGroup, setActiveGroup] = useState("overview");
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const [shortlistSchools, setShortlistSchools] = useState<SchoolListItem[]>([]);
  const [shortlistComparedSchools, setShortlistComparedSchools] = useState<SchoolListItem[]>([]);
  const [shortlistLoading, setShortlistLoading] = useState(shortlistOnly);
  const [shortlistError, setShortlistError] = useState<string | null>(null);
  const comparisonSchools = shortlistOnly ? shortlistComparedSchools : comparedSchools;
  const [schoolDetails, setSchoolDetails] = useState<Record<string, {
    loading?: boolean;
    facilities?: SchoolDetail["facilities_detail"];
    error?: string;
  }>>({});

  useEffect(() => {
    if (!shortlistOnly) return;

    let cancelled = false;
    setShortlistSchools([]);
    setShortlistComparedSchools([]);
    setShortlistLoading(true);
    setShortlistError(null);
    dashboards.parent()
      .then(async (parentDashboard) => {
        const outcomes = await Promise.all(
          parentDashboard.shortlist.map(async (item) => {
            try {
              const response = await schools.list({
                search: item.school_name,
                page_size: 100,
              });
              const school = response.results.find(
                (result) => result.school_id === item.school_id,
              );
              if (!school) {
                throw new Error("The school is no longer available in the directory.");
              }
              return { name: item.school_name, school, error: null };
            } catch (reason: unknown) {
              return {
                name: item.school_name,
                school: null,
                error: reason instanceof Error
                  ? reason.message
                  : "School details could not be loaded.",
              };
            }
          }),
        );
        if (cancelled) return;

        setShortlistSchools(
          outcomes.flatMap((outcome) => outcome.school ? [outcome.school] : []),
        );
        const failures = outcomes.filter((outcome) => outcome.error);
        if (failures.length) {
          setShortlistError(
            `${failures.length} shortlisted school${failures.length === 1 ? "" : "s"} could not be loaded. ${failures[0]!.name}: ${failures[0]!.error}`,
          );
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setShortlistError(
          reason instanceof Error
            ? reason.message
            : "Your parent shortlist could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setShortlistLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shortlistOnly]);

  useEffect(() => {
    let cancelled = false;
    if (!comparisonSchools.length) {
      setSchoolDetails({});
      return;
    }

    setSchoolDetails(
      Object.fromEntries(comparisonSchools.map((school) => [school.school_id, { loading: true }])),
    );
    Promise.all(comparisonSchools.map(async (school) => {
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
  }, [comparisonSchools]);

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
    if (!row.score || !row.prefer || comparisonSchools.length < 2) return -1;
    const scored = comparisonSchools.map((school, index) => ({ index, score: row.score!(school) }));
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
    if (!differencesOnly || comparisonSchools.length < 2) return true;
    const values = comparisonSchools.map((school) => row.value(school));
    return new Set(values).size > 1;
  });
  const ActiveGroupIcon = activeComparisonGroup.icon;

  function openSlot(index: number) {
    setActiveSlot(Math.min(index, comparisonSchools.length));
    setQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSelectionMessage(null);
    if (!shortlistOnly) {
      window.setTimeout(() => searchInput.current?.focus(), 0);
    }
  }

  function chooseSchool(school: SchoolListItem) {
    if (activeSlot === null) return;
    assignSchoolToSlot(activeSlot, school);
    setSelectionMessage(`${school.school_name} added to slot ${activeSlot + 1}.`);
    setActiveSlot(null);
    setQuery("");
    setSearchResults([]);
  }

  function chooseShortlistSchool(school: SchoolListItem) {
    if (activeSlot === null) return;
    const selectedElsewhere = comparisonSchools.some(
      (item, index) => item.school_id === school.school_id && index !== activeSlot,
    );
    if (selectedElsewhere) {
      setSelectionMessage(`${school.school_name} is already in this comparison.`);
      return;
    }

    setShortlistComparedSchools((current) => {
      const next = [...current];
      next[Math.min(activeSlot, next.length)] = school;
      return next;
    });
    setSelectionMessage(`${school.school_name} added to your shortlist comparison.`);
    setActiveSlot(null);
  }

  function removeComparedSchool(schoolId: string) {
    if (shortlistOnly) {
      setShortlistComparedSchools((current) =>
        current.filter((school) => school.school_id !== schoolId),
      );
    } else {
      removeSchool(schoolId);
    }
  }

  function clearComparison() {
    if (shortlistOnly) {
      setShortlistComparedSchools([]);
    } else {
      clearSchools();
    }
    setQuery("");
    setSelectionMessage(null);
    setActiveSlot(null);
    setSearchResults([]);
  }

  return (
    <main className="compare-page compare-page--studio">
      <Link className="school-detail__back" href="/schools">
        <ArrowLeft size={15} /> Back to school search
      </Link>
      <div className="compare-page__heading compare-page__heading--center">
        <div>
          <div className="section-eyebrow">SCHOOL COMPARISON WORKSPACE</div>
          <h1>{shortlistOnly ? "Compare your shortlisted schools." : "Find the right fit, side by side."}</h1>
          <p>
            {shortlistOnly
              ? "Choose only from schools saved in your parent dashboard."
              : "Build a shortlist and explore the details that matter most to your family."}
          </p>
          <div className="compare-page__trust">
            <span><Building2 size={17} aria-hidden /> Compare up to three schools</span>
            <span><ShieldCheck size={17} aria-hidden /> Based on published details</span>
          </div>
        </div>
        {comparisonSchools.length > 0 && (
          <button
            type="button"
            onClick={clearComparison}
          >
            Clear comparison
          </button>
        )}
      </div>

      {storageError && <p role="alert">{storageError}</p>}
      <section className="compare-slot-picker" aria-labelledby="compare-builder-heading">
        <h2 id="compare-builder-heading">Choose schools to compare</h2>
        <p>
          {shortlistOnly
            ? "Choose a slot, then select a school saved in your parent dashboard. Compare up to three."
            : "Choose up to three schools and explore the details that matter most to your family."}
        </p>
        <div className="compare-slots">
          {Array.from({ length: 3 }, (_, index) => {
            const school = comparisonSchools[index];
            const image = school
              ? publicSchoolImageUrl(school.school_image_url || school.school_logo_url)
              : null;
            const isActive = activeSlot === index;

            if (!school) {
              return (
                <button
                  className={`compare-slot__select${isActive ? " is-active" : ""}`}
                  type="button"
                  key={`empty-${index}`}
                  aria-pressed={isActive}
                  onClick={() => openSlot(index)}
                >
                  <span className="compare-slot__number">{index + 1}</span>
                  <span className="compare-slot__search"><Search size={26} aria-hidden /></span>
                  <strong>Select School</strong>
                  <small>
                    {isActive
                      ? shortlistOnly
                        ? "Choose from your shortlist below"
                        : "Search by school name below"
                      : shortlistOnly
                        ? "Tap to choose from your shortlist"
                        : "Tap to search and add"}
                  </small>
                </button>
              );
            }

            return (
              <article
                className={`compare-school-card${isActive ? " is-active" : ""}`}
                key={school.school_id}
              >
                <span className="compare-slot__number">{index + 1}</span>
                <button
                  className="compare-school-card__change"
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => openSlot(index)}
                >
                  <span className="compare-school-card__photo">
                    {image ? (
                      <Image src={image} alt="" width={76} height={76} unoptimized />
                    ) : (
                      <GraduationCap size={28} aria-hidden />
                    )}
                  </span>
                  <strong>{school.school_name}</strong>
                  <small>{[school.city_name, school.state_name].filter(Boolean).join(", ")}</small>
                  <span className="compare-school-card__rating">
                    <b>{school.average_rating == null ? "—" : school.average_rating.toFixed(1)}</b>
                    <span aria-label={school.average_rating == null ? "No ratings yet" : `${school.average_rating.toFixed(1)} out of 5`}>
                      {Array.from({ length: 5 }, (_, star) => (
                        <Star
                          key={star}
                          size={15}
                          fill={school.average_rating != null && star < Math.round(school.average_rating) ? "currentColor" : "none"}
                          aria-hidden
                        />
                      ))}
                    </span>
                    <small>{school.review_count ? `${school.review_count} reviews` : "No ratings yet"}</small>
                  </span>
                  <span className="compare-slot__change">
                    {shortlistOnly ? "Change from shortlist" : "Change school"}
                  </span>
                </button>
                <div className="compare-school-card__actions">
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
                    View School
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeComparedSchool(school.school_id)}
                    aria-label={`Remove ${school.school_name} from comparison`}
                  >
                    <X size={15} aria-hidden /> Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {selectionMessage && <p className="compare-selection-message" role="status">{selectionMessage}</p>}
        {shortlistOnly && activeSlot !== null && (
          <div className="compare-slot-picker__search">
            <div className="compare-school-picker" aria-label="Choose a school from your shortlist">
              <strong>Schools in your parent shortlist</strong>
              {shortlistLoading && <p role="status">Loading your shortlisted schools…</p>}
              {shortlistError && <p role="alert">{shortlistError}</p>}
              {!shortlistLoading && !shortlistSchools.length && !shortlistError && (
                <p role="status">You have no shortlisted schools to compare yet.</p>
              )}
              {shortlistSchools.length > 0 && (
                <ul className="compare-school-picker__results">
                  {shortlistSchools.map((school) => {
                    const selected = comparisonSchools.some(
                      (item) => item.school_id === school.school_id,
                    );
                    const resultImage = publicSchoolImageUrl(
                      school.school_image_url || school.school_logo_url,
                    );
                    return (
                      <li key={school.school_id}>
                        <span className="compare-school-picker__image">
                          {resultImage ? (
                            <Image src={resultImage} alt="" width={48} height={48} unoptimized />
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
                          onClick={() => chooseShortlistSchool(school)}
                        >
                          {selected ? "Already added" : <><Plus size={15} /> Add school</>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              className="compare-slot-picker__cancel"
              type="button"
              onClick={() => setActiveSlot(null)}
            >
              Cancel
            </button>
          </div>
        )}
        {!shortlistOnly && activeSlot !== null && (
          <div className="compare-slot-picker__search">
            <div className="compare-school-picker" aria-label={`Search for a school for slot ${activeSlot + 1}`}>
              <label htmlFor="compare-school-search">
                <Search size={17} aria-hidden />
                <span className="sr-only">Search for a school to compare</span>
                <input
                  ref={searchInput}
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
              {searchError && <p role="alert">{searchError}</p>}
              {searchLoading && <p role="status">Searching schools…</p>}
              {!searchLoading && query.trim().length >= 2 && !searchError && searchResults.length === 0 && (
                <p role="status">No matching schools found.</p>
              )}
              {searchResults.length > 0 && (
                <ul className="compare-school-picker__results">
                  {searchResults.map((school) => {
                    const selected = comparisonSchools.some((item) => item.school_id === school.school_id);
                    const resultImage = publicSchoolImageUrl(school.school_image_url || school.school_logo_url);
                    return (
                      <li key={school.school_id}>
                        <span className="compare-school-picker__image">
                          {resultImage ? (
                            <Image src={resultImage} alt="" width={48} height={48} unoptimized />
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
                          onClick={() => chooseSchool(school)}
                        >
                          {selected ? "Already added" : <><Plus size={15} /> Add school</>}
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
            <button
              className="compare-slot-picker__cancel"
              type="button"
              onClick={() => {
                setActiveSlot(null);
                setQuery("");
                setSearchResults([]);
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      <header className="compare-section-heading compare-section-heading--categories">
        <span>COMPARE BY CATEGORY</span>
        <h2>See how each school compares</h2>
      </header>

      <div className="compare-categories-layout">
        <nav className="compare-category-nav" aria-label="Comparison categories" role="tablist" aria-orientation="vertical">
          {groups.map((group, index) => {
            const GroupIcon = group.icon;
            return (
              <button
                className={activeGroup === group.id ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={activeGroup === group.id}
                aria-controls="compare-category-panel"
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
              >
                <span className="compare-category-nav__icon"><GroupIcon size={18} aria-hidden /></span>
                <span className="compare-category-nav__copy">
                  <strong>{group.label}</strong>
                  <small>{group.rows.length} {group.rows.length === 1 ? "item" : "items"}</small>
                </span>
                <span className="compare-category-nav__number">{String(index + 1).padStart(2, "0")}</span>
              </button>
            );
          })}
        </nav>

        <section
          className="compare-category-panel"
          id="compare-category-panel"
          role="tabpanel"
          aria-label={`${activeComparisonGroup.label} comparison`}
          style={{ ["--compare-cols" as string]: Math.max(comparisonSchools.length, 1) }}
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

        {comparisonSchools.length === 0 ? (
          <div className="compare-category-panel__empty">
            <span><Search size={22} aria-hidden /></span>
            <strong>Your comparison starts with a school.</strong>
            <p>Search above to add schools and see their {activeComparisonGroup.label.toLowerCase()} details side by side.</p>
          </div>
        ) : (
          <>
          <div
            className="compare-matrix-scroller"
            role="region"
            aria-label="Side-by-side school comparison; scroll horizontally to compare all schools"
            tabIndex={0}
          >
            <div className="compare-matrix__schools">
              <div className="compare-matrix__label">SCHOOL</div>
              {comparisonSchools.map((school, index) => {
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
                      onClick={() => removeComparedSchool(school.school_id)}
                      aria-label={`Remove ${school.school_name} from comparison`}
                    >
                      <X size={15} />
                    </button>
                  </article>
                );
              })}
            </div>

            {comparisonSchools.length < 2 && (
              <p className="compare-category-panel__hint">Add another school to unlock the side-by-side comparison.</p>
            )}

            <div className="compare-matrix">
              {activeRows.length ? activeRows.map((row) => {
                const winner = winningIndex(row);
                return (
                  <div className="compare-matrix__row" key={row.label}>
                    <div className="compare-matrix__label">{row.label}</div>
                    {comparisonSchools.map((school, index) => (
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
            </div>
            <p className="compare-matrix__scroll-hint">Swipe horizontally to see each school&apos;s details.</p>
          </>
        )}
        </section>
      </div>
    </main>
  );
}
