"use client";

import {
  ArrowDownUp,
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  LoaderCircle,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { schools } from "@/lib/api";
import type { SchoolFilters, SchoolListItem, SchoolTypeListItem } from "@/lib/api";

const genderOptions: { label: string; value: SchoolFilters["gender"] }[] = [
  { label: "Any", value: undefined },
  { label: "Co-ed", value: "COED" },
  { label: "Boys", value: "BOYS" },
  { label: "Girls", value: "GIRLS" },
];

const orderingOptions: Record<string, NonNullable<SchoolFilters["ordering"]>> = {
  school_name: "school_name",
  "-school_name": "-school_name",
  established_year: "established_year",
  "-established_year": "-established_year",
};

function SchoolCard({ school }: { school: SchoolListItem }) {
  const location = [school.city_name, school.state_name].filter(Boolean).join(", ");

  return (
    <article className="school-card">
      <div className="school-card__top">
        <div className="school-card__avatar" aria-hidden="true">
          <Building2 size={23} strokeWidth={1.7} />
        </div>
        <div className="school-card__title">
          <div className="school-card__eyebrow">
            {school.verification_status?.toLowerCase() === "verified" && (
              <span className="verified-tag">
                <CheckCircle2 size={13} />
                Verified
              </span>
            )}
            {school.established_year && <span>Est. {school.established_year}</span>}
          </div>
          <h3><Link href={`/schools/${school.slug}`}>{school.school_name}</Link></h3>
          <p className="school-card__location">
            <MapPin size={14} />
            {location || "Location not listed"}
          </p>
        </div>
      </div>

      <div className="school-card__tags">
        {school.school_type_name && <span className="school-tag">{school.school_type_name}</span>}
        {school.board_name && <span className="school-tag school-tag--blue">{school.board_name}</span>}
        {school.gender && <span className="school-tag school-tag--plain">{school.gender}</span>}
      </div>

      <div className="school-card__footer">
        <p>{school.address || "Contact the school for address details."}</p>
        <div className="school-card__actions">
          <Link href={`/schools/${school.slug}`}>View details</Link>
          {school.phone && <a href={`tel:${school.phone}`}>Call school</a>}
          {school.email && (
            <a className="school-card__email" href={`mailto:${school.email}`} aria-label={`Email ${school.school_name}`}>
              <ArrowRight size={16} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function SchoolDiscovery() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [schoolTypesError, setSchoolTypesError] = useState<string | null>(null);
  const [gender, setGender] = useState<SchoolFilters["gender"]>();
  const [ordering, setOrdering] = useState<SchoolFilters["ordering"]>("school_name");
  const [results, setResults] = useState<SchoolListItem[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const queryKey = `${search}|${schoolType}|${gender ?? ""}|${ordering ?? ""}`;
  const activeQuery = useRef(queryKey);
  activeQuery.current = queryKey;

  useEffect(() => {
    let cancelled = false;
    const filters: SchoolFilters = {
      search: search || undefined,
      school_type: schoolType || undefined,
      gender,
      ordering,
    };
    activeQuery.current = queryKey;
    setLoading(true);
    setError(null);
    setLoadingMore(false);

    schools.list(filters)
      .then((response) => {
        if (cancelled) return;
        setResults(response.results);
        setNextPage(response.next);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setResults([]);
        setNextPage(null);
        setError(reason instanceof Error ? reason.message : "Could not load schools.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, schoolType, gender, ordering, queryKey, retryCount]);

  useEffect(() => {
    let cancelled = false;
    schools.types()
      .then((response) => {
        if (!cancelled) setSchoolTypes(response.results.filter((type) => type.status));
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setSchoolTypesError(reason instanceof Error ? reason.message : "Could not load school types.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setSchoolType("");
    setGender(undefined);
    setOrdering("school_name");
  }

  async function loadMore() {
    if (!nextPage || loadingMore) return;
    const requestedQuery = queryKey;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await schools.page(nextPage);
      if (activeQuery.current !== requestedQuery) return;
      setResults((current) => [...current, ...response.results]);
      setNextPage(response.next);
    } catch (reason: unknown) {
      if (activeQuery.current === requestedQuery) {
        setError(reason instanceof Error ? reason.message : "Could not load more schools.");
      }
    } finally {
      if (activeQuery.current === requestedQuery) setLoadingMore(false);
    }
  }

  const hasFilters = Boolean(search || schoolType || gender || ordering !== "school_name");
  const popularBoardingType =
    schoolTypes.find((type) => type.slug === "full-boarding") ??
    schoolTypes.find((type) => type.slug.includes("boarding"));
  const popularSearches = ["Bengaluru", "CBSE", ...(popularBoardingType ? [popularBoardingType.type_name] : [])];

  return (
    <main className="discovery-page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="BoardingEdu home">
          <Image className="brand__image" src="/BoardingEdu_LOGO.jpeg" alt="BoardingEdu" width={1024} height={1024} priority />
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <a className="header-nav__active" href="#schools">Find a school</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <a className="header-action" href="#schools">Explore schools <ArrowRight size={15} /></a>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <div className="hero__kicker"><Compass size={15} /> YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>Find a school<br />where they can <em>thrive.</em></h1>
          <p>Discover trusted schools, compare what matters, and take the next step with confidence.</p>
          <form className="hero-search" onSubmit={submitSearch} role="search">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="school-search">Search schools, cities, or boards</label>
            <input
              id="school-search"
              type="search"
              placeholder="Try a school, city, or board"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput && (
              <button className="search-clear" type="button" onClick={() => setSearchInput("")} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
            <button className="hero-search__submit" type="submit">Search</button>
          </form>
          <div className="hero__hint">
            <span>Popular:</span>
            {popularSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  const selectedType = schoolTypes.find((type) => type.type_name === term);
                  if (selectedType) {
                    setSchoolType(selectedType.school_type_id);
                    setSearchInput("");
                    setSearch("");
                    return;
                  }
                  setSearchInput(term);
                  setSearch(term);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art__sun" />
          <div className="hero-art__orbit hero-art__orbit--one" />
          <div className="hero-art__orbit hero-art__orbit--two" />
          <div className="hero-art__card">
            <div className="hero-art__building">
              <div className="building-roof" />
              <div className="building-body">
                <span /><span /><span /><span /><span /><span />
                <div className="building-door" />
              </div>
            </div>
            <span className="hero-art__label">A brighter future, together</span>
          </div>
          <span className="hero-art__spark hero-art__spark--one">✳</span>
          <span className="hero-art__spark hero-art__spark--two">✳</span>
          <span className="hero-art__dot" />
        </div>
      </section>

      <section className="discovery-content" id="schools">
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">THE RIGHT FIT IS OUT THERE</div>
            <h2>Explore schools</h2>
            <p>Start with what matters most to your family.</p>
          </div>
          <div className="results-count" aria-live="polite">
            {loading ? "Finding schools…" : `${results.length} ${results.length === 1 ? "school" : "schools"} shown`}
          </div>
        </div>

        <div className="results-layout">
          <aside className="filters-panel" aria-label="School filters">
            <div className="filters-panel__heading">
              <div><SlidersHorizontal size={17} /><h3>Refine your search</h3></div>
              {hasFilters && <button type="button" onClick={clearFilters}>Clear all</button>}
            </div>

            <fieldset className="filter-group">
              <legend>School type</legend>
              <label className="filter-select-label" htmlFor="school-type-filter">Choose a school type</label>
              <select
                className="filter-select"
                id="school-type-filter"
                value={schoolType}
                onChange={(event) => setSchoolType(event.target.value)}
              >
                <option value="">All school types</option>
                {schoolTypes.map((type) => (
                  <option key={type.school_type_id} value={type.school_type_id}>{type.type_name}</option>
                ))}
              </select>
              {schoolTypesError && <p className="filter-error" role="alert">School type filters unavailable: {schoolTypesError}</p>}
            </fieldset>

            <fieldset className="filter-group">
              <legend>Student community</legend>
              <div className="gender-options">
                {genderOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={gender === option.value ? "gender-option gender-option--active" : "gender-option"}
                    aria-pressed={gender === option.value}
                    onClick={() => setGender(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="filter-note">
              <span className="filter-note__icon"><CheckCircle2 size={16} /></span>
              <p>School information is provided by the school directory. Contact schools directly to confirm current details.</p>
            </div>
          </aside>

          <div className="school-results">
            <div className="school-results__toolbar">
              <div className="school-results__label">
                <span className="school-results__icon"><Building2 size={16} /></span>
                <span>Schools in the directory</span>
              </div>
              <label className="sort-control">
                <ArrowDownUp size={14} />
                <span className="sr-only">Sort schools</span>
                <select
                  value={ordering}
                  onChange={(event) => {
                    const selected = orderingOptions[event.target.value];
                    if (selected) setOrdering(selected);
                  }}
                  aria-label="Sort schools"
                >
                  <option value="school_name">Name: A to Z</option>
                  <option value="-school_name">Name: Z to A</option>
                  <option value="-established_year">Newest established</option>
                  <option value="established_year">Oldest established</option>
                </select>
              </label>
            </div>

            {error && (
              <div className="state-panel state-panel--error" role="alert">
                <h3>We couldn’t load schools</h3>
                <p>{error}</p>
                <button type="button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button>
              </div>
            )}
            {loading && (
              <div className="state-panel" role="status">
                <LoaderCircle className="spin" size={23} />
                <span>Finding schools for you…</span>
              </div>
            )}
            {!loading && !error && results.length === 0 && (
              <div className="state-panel state-panel--empty">
                <Search size={25} />
                <h3>No schools found</h3>
                <p>Try a different search or remove a filter to see more results.</p>
                <button type="button" onClick={clearFilters}>Clear search and filters</button>
              </div>
            )}
            {!loading && !error && results.length > 0 && (
              <>
                <div className="school-list">
                  {results.map((school) => <SchoolCard key={school.school_id} school={school} />)}
                </div>
                {nextPage && (
                  <button className="load-more" type="button" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? <><LoaderCircle className="spin" size={17} /> Loading…</> : <>Load more schools <ArrowRight size={16} /></>}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="how-it-works" id="how-it-works">
        <div className="how-it-works__intro">
          <div className="section-eyebrow">A LITTLE LESS OVERWHELMING</div>
          <h2>Three steps to a more confident choice.</h2>
        </div>
        <div className="how-it-works__steps">
          <article>
            <span>01</span>
            <h3>Explore</h3>
            <p>Search the directory by school, city, or education board.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Find your fit</h3>
            <p>Filter by school type and student community to narrow your options.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Reach out</h3>
            <p>Review the school details and contact the school directly.</p>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <a className="brand brand--footer" href="/" aria-label="BoardingEdu home">
          <Image className="brand__image" src="/BoardingEdu_LOGO.jpeg" alt="BoardingEdu" width={1024} height={1024} />
        </a>
        <p>Helping every family find a place to belong.</p>
      </footer>
    </main>
  );
}
