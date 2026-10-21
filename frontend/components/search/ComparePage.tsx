"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Plus, Search, X } from "lucide-react";
import { schools, type SchoolListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";
import { useSearchExperience } from "@/lib/search-experience";
import { schoolTypeLabel } from "@/lib/seo-slugs";

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

  const rows = [
    {
      label: "Location",
      value: (school: (typeof comparedSchools)[number]) =>
        [school.city_name, school.state_name].filter(Boolean).join(", ") || "Not listed",
    },
    {
      label: "Education boards",
      value: (school: (typeof comparedSchools)[number]) =>
        school.boards_detail.map((board) => board.board_name).join(", ") || "Not listed",
    },
    {
      label: "School types",
      value: (school: (typeof comparedSchools)[number]) =>
        school.school_types_detail.map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name)).join(", ") || "Not listed",
    },
    {
      label: "Student community",
      value: (school: (typeof comparedSchools)[number]) => school.gender || "Not listed",
    },
    {
      label: "Annual fees",
      value: (school: (typeof comparedSchools)[number]) =>
        school.annual_fee == null
          ? "Not published"
          : `₹${new Intl.NumberFormat("en-IN").format(Number(school.annual_fee))}`,
    },
    {
      label: "Academics & teaching rating",
      value: (school: (typeof comparedSchools)[number]) =>
        school.academics_rating == null
          ? "No parent ratings yet"
          : `${school.academics_rating.toFixed(1)} / 5`,
    },
    {
      label: "Facilities & campus rating",
      value: (school: (typeof comparedSchools)[number]) =>
        school.facilities_rating == null
          ? "No parent ratings yet"
          : `${school.facilities_rating.toFixed(1)} / 5`,
    },
    {
      label: "Safety & wellbeing rating",
      value: (school: (typeof comparedSchools)[number]) =>
        school.safety_rating == null
          ? "No parent ratings yet"
          : `${school.safety_rating.toFixed(1)} / 5`,
    },
    {
      label: "Communication & admissions rating",
      value: (school: (typeof comparedSchools)[number]) =>
        school.communication_rating == null
          ? "No parent ratings yet"
          : `${school.communication_rating.toFixed(1)} / 5`,
    },
    {
      label: "Established",
      value: (school: (typeof comparedSchools)[number]) =>
        school.established_year?.toString() ?? "Not listed",
    },
  ];

  return (
    <main className="compare-page">
      <Link className="school-detail__back" href="/schools">
        <ArrowLeft size={15} /> Back to school search
      </Link>
      <div className="compare-page__heading">
        <div>
          <div className="section-eyebrow">MAKE AN INFORMED CHOICE</div>
          <h1>Compare schools</h1>
          <p>
            {comparedSchools.length < 2
              ? "Choose another school to compare side by side."
              : "Review the details that matter side by side."}
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
                      {school.school_image_url || school.school_logo_url ? (
                        <Image
                          src={school.school_image_url || school.school_logo_url || ""}
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

      {comparedSchools.length === 0 ? (
        <section className="compare-empty">
          <h2>No schools selected yet</h2>
          <p>Search above or browse the directory to select up to four schools.</p>
          <Link href="/schools/">Browse schools</Link>
        </section>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">School detail</th>
                {comparedSchools.map((school) => (
                  <th scope="col" key={school.school_id}>
                    <div className="compare-table__school">
                      {school.school_image_url || school.school_logo_url ? (
                        <Image
                          className="compare-table__school-image"
                          src={school.school_image_url || school.school_logo_url || ""}
                          alt=""
                          width={48}
                          height={48}
                          unoptimized
                        />
                      ) : (
                        <span className="compare-table__school-image compare-table__school-image--empty">
                          <GraduationCap size={20} aria-hidden />
                        </span>
                      )}
                      <strong>{school.school_name}</strong>
                      <button
                        type="button"
                        onClick={() => removeSchool(school.school_id)}
                        aria-label={`Remove ${school.school_name} from comparison`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <Link
                      href={schoolProfilePathFromSlugs({
                        countrySlug: school.country_slug,
                        stateSlug: school.state_slug,
                        citySlug: school.city_slug,
                        localitySlug: school.location_slug,
                        schoolSlug: school.slug,
                      })}
                    >
                      View profile
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {comparedSchools.map((school) => (
                    <td key={school.school_id}>{row.value(school)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
