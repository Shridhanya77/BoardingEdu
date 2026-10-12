"use client";

import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { useSearchExperience } from "@/lib/search-experience";

export default function ComparePage() {
  const {
    comparedSchools,
    hydrated,
    removeSchool,
    clearSchools,
    storageError,
  } = useSearchExperience();

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
        school.school_types_detail.map((type) => type.type_name).join(", ") || "Not listed",
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
      label: "Established",
      value: (school: (typeof comparedSchools)[number]) =>
        school.established_year?.toString() ?? "Not listed",
    },
  ];

  return (
    <main className="compare-page">
      <Link className="school-detail__back" href="/#schools">
        <ArrowLeft size={15} /> Back to school search
      </Link>
      <div className="compare-page__heading">
        <div>
          <div className="section-eyebrow">MAKE AN INFORMED CHOICE</div>
          <h1>Compare schools</h1>
          <p>Review the details that matter side by side.</p>
        </div>
        {comparedSchools.length > 0 && (
          <button type="button" onClick={clearSchools}>
            Clear comparison
          </button>
        )}
      </div>

      {storageError && <p role="alert">{storageError}</p>}
      {comparedSchools.length === 0 ? (
        <section className="compare-empty">
          <h2>No schools selected yet</h2>
          <p>Select up to three schools from the directory to compare them.</p>
          <Link href="/#schools">Browse schools</Link>
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
                      href={`/${school.country_slug}/${school.state_slug}/${school.city_slug}/${school.slug}`}
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
