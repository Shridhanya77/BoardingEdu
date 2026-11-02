"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, LoaderCircle, MapPin, Search, X } from "lucide-react";
import {
  searchApi,
  type SearchLocationSuggestion,
  type SearchSchoolSuggestion,
} from "@/lib/api";
import { publicSchoolImageUrl } from "@/lib/school-media";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";
import { placeListingPath, schoolSearchPath } from "@/lib/school-urls";

type Option =
  | { kind: "school"; school: SearchSchoolSuggestion }
  | { kind: "location"; location: SearchLocationSuggestion };

type Props = {
  placeholder?: string;
  ariaLabel?: string;
  variant?: "hero" | "inline";
  /** Pre-fill the input (e.g. the active listing search term). */
  initialQuery?: string;
  /** Called after a selection navigates, useful to close mobile menus. */
  onNavigate?: (href: string) => void;
  /**
   * Called when the user submits text with no result highlighted. When
   * provided, the host owns navigation (e.g. the listing page filters in
   * place instead of leaving the page).
   */
  onFreeTextSubmit?: (query: string) => void;
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 280;

function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  const index = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function schoolHref(school: SearchSchoolSuggestion): string {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
    schoolName: school.school_name,
    schoolTypeName: school.school_type_name,
    schoolTypeNames: school.school_type_names,
  });
}

function locationHref(location: SearchLocationSuggestion): string {
  return placeListingPath({
    countrySlug: location.country_slug ?? "india",
    stateSlug: location.state_slug,
    citySlug: location.city_slug,
    locationSlug: location.location_slug,
  });
}

function optionHref(option: Option): string {
  return option.kind === "school"
    ? schoolHref(option.school)
    : locationHref(option.location);
}

function locationLabel(kind: SearchLocationSuggestion["kind"]): string {
  return kind === "state" ? "State" : kind === "city" ? "City" : "Locality";
}

/**
 * Shared live-autocomplete used by the homepage hero and the school listing
 * page. Results come from `/api/search/suggestions/` and are split into real
 * school records and real locations (never fabricated).
 */
export default function SchoolSearchAutocomplete({
  placeholder = "Search a school, city, state, or locality",
  ariaLabel = "Search schools and locations",
  variant = "inline",
  initialQuery = "",
  onNavigate,
  onFreeTextSubmit,
}: Props) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schools, setSchools] = useState<SearchSchoolSuggestion[]>([]);
  const [locations, setLocations] = useState<SearchLocationSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const options = useMemo<Option[]>(
    () => [
      ...schools.map((school) => ({ kind: "school" as const, school })),
      ...locations.map((location) => ({ kind: "location" as const, location })),
    ],
    [schools, locations],
  );

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < MIN_QUERY_LENGTH) {
      setSchools([]);
      setLocations([]);
      setLoading(false);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchApi
        .suggest(normalized)
        .then((response) => {
          if (cancelled) return;
          setSchools(response.schools);
          setLocations(response.locations);
          setError(null);
          setActiveIndex(-1);
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setSchools([]);
          setLocations([]);
          setError(
            reason instanceof Error ? reason.message : "Could not load suggestions.",
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    onNavigate?.(href);
    router.push(href);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) go(optionHref(option));
  }

  function submitFreeText(normalized: string) {
    setOpen(false);
    if (onFreeTextSubmit) {
      onFreeTextSubmit(normalized);
      return;
    }
    router.push(schoolSearchPath(normalized));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (options.length) {
        setActiveIndex((current) => (current + 1) % options.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length) {
        setActiveIndex((current) => (current - 1 + options.length) % options.length);
      }
      return;
    }
    if (event.key === "Enter") {
      const normalized = query.trim();
      if (activeIndex >= 0 && options[activeIndex]) {
        event.preventDefault();
        choose(activeIndex);
      } else if (normalized) {
        event.preventDefault();
        submitFreeText(normalized);
      }
    }
  }

  const showDropdown = open && query.trim().length >= MIN_QUERY_LENGTH;
  const hasResults = options.length > 0;

  return (
    <div
      ref={rootRef}
      className={`search-ac search-ac--${variant}`}
      data-open={showDropdown || undefined}
    >
      <form
        className="search-ac__field"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const normalized = query.trim();
          if (!normalized) return;
          if (activeIndex >= 0 && options[activeIndex]) {
            choose(activeIndex);
          } else {
            submitFreeText(normalized);
          }
        }}
      >
        <Search size={18} aria-hidden className="search-ac__icon" />
        <input
          className="search-ac__input"
          type="text"
          value={query}
          placeholder={placeholder}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && (
          <LoaderCircle size={17} aria-hidden className="search-ac__spinner" />
        )}
        {!loading && query && (
          <button
            type="button"
            className="search-ac__clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setSchools([]);
              setLocations([]);
              setActiveIndex(-1);
            }}
          >
            <X size={16} aria-hidden />
          </button>
        )}
        <button type="submit" className="search-ac__submit">
          Search
        </button>
      </form>

      {showDropdown && (
        <div className="search-ac__panel" role="listbox" id={listId} aria-label="Search suggestions">
          {error ? (
            <p className="search-ac__state search-ac__state--error" role="alert">
              Suggestions are unavailable right now. Press Enter to search anyway.
            </p>
          ) : !hasResults && !loading ? (
            <p className="search-ac__state" role="status">
              No matching schools found. Try another name, city, or state.
            </p>
          ) : (
            <>
              {schools.length > 0 && (
                <div className="search-ac__group">
                  <p className="search-ac__group-label">Schools</p>
                  {schools.map((school, index) => {
                    const image = publicSchoolImageUrl(school.school_image_url);
                    const globalIndex = index;
                    return (
                      <button
                        type="button"
                        role="option"
                        id={`${listId}-option-${globalIndex}`}
                        aria-selected={activeIndex === globalIndex}
                        key={school.school_id}
                        className={`search-ac__option${activeIndex === globalIndex ? " is-active" : ""}`}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        onClick={() => go(schoolHref(school))}
                      >
                        <span className="search-ac__thumb" aria-hidden>
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={image} alt="" loading="lazy" />
                          ) : (
                            <GraduationCap size={18} />
                          )}
                        </span>
                        <span className="search-ac__option-copy">
                          <strong>
                            <Highlighted text={school.school_name} query={query} />
                          </strong>
                          <small>
                            {[school.city_name, school.state_name]
                              .filter(Boolean)
                              .join(", ")}
                            {school.school_type_name ? ` · ${school.school_type_name}` : ""}
                            {school.board_name ? ` · ${school.board_name}` : ""}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {locations.length > 0 && (
                <div className="search-ac__group">
                  <p className="search-ac__group-label">Locations</p>
                  {locations.map((location, index) => {
                    const globalIndex = schools.length + index;
                    return (
                      <button
                        type="button"
                        role="option"
                        id={`${listId}-option-${globalIndex}`}
                        aria-selected={activeIndex === globalIndex}
                        key={`${location.kind}-${location.slug}-${location.city_slug ?? ""}`}
                        className={`search-ac__option${activeIndex === globalIndex ? " is-active" : ""}`}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        onClick={() => go(locationHref(location))}
                      >
                        <span className="search-ac__thumb search-ac__thumb--location" aria-hidden>
                          <MapPin size={18} />
                        </span>
                        <span className="search-ac__option-copy">
                          <strong>
                            <Highlighted text={location.name} query={query} />
                          </strong>
                          <small>
                            {locationLabel(location.kind)}
                            {location.kind !== "state" && location.state_slug
                              ? ` · ${location.state_slug.replace(/-/g, " ")}`
                              : ""}
                            {location.schools_count
                              ? ` · ${location.schools_count} school${location.schools_count === 1 ? "" : "s"}`
                              : ""}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
