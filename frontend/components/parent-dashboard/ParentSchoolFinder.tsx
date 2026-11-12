"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Building2, ExternalLink, MapPin, Search, Star } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/DashboardShell";
import { apiErrorMessage, schools, type SchoolListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";

export default function ParentSchoolFinder() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedSchool = results.find((school) => school.school_id === selectedId) ?? null;

  function searchSchools(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchTerm = query.trim();
    if (!searchTerm) {
      setError("Enter a school name, city, or location to search.");
      return;
    }

    setLoading(true);
    setError(null);
    schools.list({ search: searchTerm, page_size: 8, status: true, ordering: "-is_featured" })
      .then((response) => {
        setResults(response.results);
        setSelectedId(response.results[0]?.school_id ?? null);
        setSearched(true);
      })
      .catch((reason: unknown) => setError(apiErrorMessage(reason)))
      .finally(() => setLoading(false));
  }

  const mapQuery = selectedSchool
    ? typeof selectedSchool.lat === "number" && typeof selectedSchool.lng === "number"
      ? `${selectedSchool.lat},${selectedSchool.lng}`
      : [selectedSchool.school_name, selectedSchool.city_name, selectedSchool.state_name].filter(Boolean).join(", ")
    : "";
  const mapUrl = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`
    : "";

  return (
    <DashboardPanel
      title="Find a school"
      subtitle="Search by school name or location, compare matches, and preview where each school is."
      action={<Link className="dash-link" href="/india/">Browse all schools</Link>}
    >
      <form className="pd-finder__form" onSubmit={searchSchools}>
        <label htmlFor="parent-school-search">School or location</label>
        <div>
          <Search size={18} aria-hidden />
          <input
            id="parent-school-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try a school name, Bengaluru, or North India"
            maxLength={120}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search schools"}
          </button>
        </div>
      </form>

      {error && <p className="dash-state dash-state--error" role="alert">{error}</p>}

      {searched && results.length === 0 && !loading && (
        <p className="dash-empty">No schools matched that search. Try another school name or location.</p>
      )}

      {results.length > 0 && (
        <div className="pd-finder">
          <ul className="pd-finder__results" aria-label="School search results">
            {results.map((school) => (
              <li key={school.school_id}>
                <button
                  type="button"
                  className={selectedId === school.school_id ? "is-selected" : ""}
                  onClick={() => setSelectedId(school.school_id)}
                  aria-pressed={selectedId === school.school_id}
                >
                  <span className="pd-finder__icon" aria-hidden><Building2 size={18} /></span>
                  <span className="pd-finder__school">
                    <strong>{school.school_name}</strong>
                    <span><MapPin size={13} aria-hidden /> {[school.city_name, school.state_name].filter(Boolean).join(", ")}</span>
                    {school.boards_detail.length > 0 && (
                      <small>{school.boards_detail.map((board) => board.board_name).join(" · ")}</small>
                    )}
                  </span>
                  {school.average_rating != null && (
                    <span className="pd-finder__rating"><Star size={13} aria-hidden /> {school.average_rating.toFixed(1)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="pd-finder__map">
            {selectedSchool && mapUrl ? (
              <>
                <iframe
                  src={mapUrl}
                  title={`Map showing ${selectedSchool.school_name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <LinkToSchool school={selectedSchool} />
              </>
            ) : (
              <p>Select a school to preview its location.</p>
            )}
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}

function LinkToSchool({ school }: { school: SchoolListItem }) {
  const href = schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
    schoolName: school.school_name,
    schoolTypes: school.school_types_detail,
  });

  return (
    <Link className="pd-finder__profile" href={href}>
      View school profile <ExternalLink size={14} aria-hidden />
    </Link>
  );
}
