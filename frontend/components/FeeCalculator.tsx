"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Plus, Search, X } from "lucide-react";
import {
  apiErrorMessage,
  fees,
  fetchAllPages,
  schools,
  type FeeEstimateResult,
  type AcademicYearListItem,
  type GradeListItem,
  type SchoolListItem,
  type SchoolTypeListItem,
} from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";
import { gradeSelectOptions, gradeSelectionIds } from "@/lib/grade-labels";
import {
  FEE_STREAMS,
  feeStreamLabel,
  isSeniorSecondaryGrade,
  type FeeStreamCode,
} from "@/lib/fee-streams";

function formatCurrency(value: string | null) {
  if (value === null) return "Unavailable";
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value))}`;
}

export default function FeeCalculator({ schoolSlug: initialSchoolSlug }: { schoolSlug?: string } = {}) {
  const [grades, setGrades] = useState<GradeListItem[]>([]);
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearListItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SchoolListItem[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<SchoolListItem[]>([]);
  const [gradeId, setGradeId] = useState("");
  const [stream, setStream] = useState<FeeStreamCode | "">("");
  const [schoolTypeId, setSchoolTypeId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [results, setResults] = useState<FeeEstimateResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const selectedGrade = grades.find((grade) => grade.grade_id === gradeId);
  const needsStream = isSeniorSecondaryGrade(selectedGrade);

  useEffect(() => {
    let active = true;
    Promise.all([schools.grades(), schools.types(), fees.academicYears()])
      .then(async ([gradePage, typePage, yearPage]) => {
        const [gradeRows, typeRows, yearRows] = await Promise.all([
          fetchAllPages(gradePage),
          fetchAllPages(typePage),
          fetchAllPages(yearPage),
        ]);
        if (!active) return;
        setGrades(gradeRows.filter((item) => item.status));
        setSchoolTypes(typeRows.filter((item) => item.status));
        const availableYears = yearRows.filter((item) => item.status);
        setAcademicYears(availableYears);
        setAcademicYearId(
          availableYears.find((item) => item.is_current)?.id ?? availableYears[0]?.id ?? "",
        );
      })
      .catch((reason: unknown) => {
        if (active) setCatalogError(apiErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const schoolSlug = initialSchoolSlug
      ?? new URLSearchParams(window.location.search).get("school");
    if (!schoolSlug) return;
    let active = true;
    schools.list({ search: schoolSlug, page_size: 12 })
      .then((page) => {
        const school = page.results.find((item) => item.slug === schoolSlug);
        if (active && school) setSelectedSchools([school]);
        else if (active) setError("The selected school could not be found in the public directory.");
      })
      .catch((reason: unknown) => {
        if (active) setError(`The selected school could not be loaded: ${apiErrorMessage(reason)}`);
      });
    return () => {
      active = false;
    };
  }, [initialSchoolSlug]);

  useEffect(() => {
    let active = true;
    const normalized = query.trim();
    const gradeIds = gradeSelectionIds(grades, gradeId);
    if (normalized.length < 2 || gradeIds.length === 0 || !schoolTypeId) {
      setMatches([]);
      setSearching(false);
      return;
    }
    setError(null);
    setMatches([]);
    setSearching(true);
    const timer = window.setTimeout(() => {
      Promise.all(gradeIds.map((id) => schools.list({
        search: normalized,
        page_size: 8,
        grade: id,
        school_type: schoolTypeId,
      })))
        .then((pages) => {
          if (active) {
            const uniqueSchools = new Map<string, SchoolListItem>();
            for (const school of pages.flatMap((page) => page.results)) {
              uniqueSchools.set(school.school_id, school);
            }
            setMatches(Array.from(uniqueSchools.values()).slice(0, 8));
          }
        })
        .catch((reason: unknown) => {
          if (active) setError(apiErrorMessage(reason));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [gradeId, grades, query, schoolTypeId]);

  function toggleSchool(school: SchoolListItem) {
    setSelectedSchools((current) =>
      current.some((item) => item.school_id === school.school_id)
        ? current.filter((item) => item.school_id !== school.school_id)
        : current.length < 4
          ? [...current, school]
          : current,
    );
    setError(null);
    setResults(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResults(null);
    if (!gradeId || !schoolTypeId || !academicYearId || selectedSchools.length === 0 || (needsStream && !stream)) {
      setError("Choose an academic session, grade, school type, and at least one school. Select a stream for Grade 11 or Grade 12.");
      return;
    }
    setEstimating(true);
    try {
      const response = await fees.estimate({
        school_ids: selectedSchools.map((school) => school.school_id),
        grade_ids: gradeSelectionIds(grades, gradeId),
        school_type_id: schoolTypeId,
        academic_year_id: academicYearId,
        ...(needsStream ? { stream } : {}),
      });
      setResults(response.results);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setEstimating(false);
    }
  }

  return (
    <main className="fee-calculator">
      <header className="fee-calculator__hero">
        <span className="section-eyebrow">PLAN WITH PUBLISHED FEES</span>
        <h1>Compare school fee estimates</h1>
        <p>
          Estimate annual and first-year costs from current, published school fee schedules.
          Variable or missing charges are clearly marked, not treated as zero.
        </p>
      </header>

      <form className="fee-calculator__form" onSubmit={submit}>
        <div className="fee-calculator__selectors">
          <label>
            Academic session
            <select
              value={academicYearId}
              onChange={(event) => {
                setAcademicYearId(event.target.value);
                setResults(null);
              }}
              required
            >
              <option value="">Select an academic session</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}{year.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grade
            <select
              value={gradeId}
              onChange={(event) => {
                setGradeId(event.target.value);
                setStream("");
                setError(null);
                setResults(null);
              }}
              required
            >
              <option value="">Select a grade</option>
              {gradeSelectOptions(grades).map((grade) => (
                <option key={grade.grade_id} value={grade.grade_id}>{grade.grade_name}</option>
              ))}
            </select>
          </label>
          {needsStream && (
            <label>
              Stream
              <select
                value={stream}
                onChange={(event) => {
                  setStream(event.target.value as FeeStreamCode | "");
                  setError(null);
                  setResults(null);
                }}
                required
              >
                <option value="">Select a stream</option>
                {FEE_STREAMS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            School type
            <select
              value={schoolTypeId}
              onChange={(event) => {
                setSchoolTypeId(event.target.value);
                setError(null);
                setResults(null);
              }}
              required
            >
              <option value="">Select a school type</option>
              {schoolTypes.map((type) => (
                <option key={type.school_type_id} value={type.school_type_id}>{type.type_name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="fee-calculator__school-search">
          <span>Schools <small>Choose up to four to compare</small></span>
          <span className="fee-calculator__search-control">
            <Search size={17} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setError(null);
              }}
              placeholder={gradeId && schoolTypeId
                ? "Search schools by name or location"
                : "Choose a grade and school type first"}
              aria-label="Search schools to compare"
              disabled={!gradeId || !schoolTypeId}
            />
          </span>
        </label>
        {(!gradeId || !schoolTypeId) && (
          <p className="fee-calculator__message" role="status">
            Choose a grade and school type before searching for schools.
          </p>
        )}
        {catalogError && <p className="fee-calculator__message" role="alert">{catalogError}</p>}
        {searching && <p className="fee-calculator__message" role="status">Searching schools…</p>}
        {!searching && !error && gradeId && schoolTypeId && query.trim().length >= 2 && matches.length === 0 && (
          <p className="fee-calculator__message" role="status">
            No schools match that name, grade, and school type.
          </p>
        )}
        {matches.length > 0 && (
          <div className="fee-calculator__matches" aria-label="School search results">
            {matches.map((school) => {
              const selected = selectedSchools.some((item) => item.school_id === school.school_id);
              const disabled = !selected && selectedSchools.length >= 4;
              return (
                <button
                  key={school.school_id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleSchool(school)}
                >
                  <span>
                    <strong>{school.school_name}</strong>
                    <small>{school.city_name}, {school.state_name}</small>
                  </span>
                  {selected ? <Check size={17} aria-label="Selected" /> : <Plus size={17} aria-hidden />}
                </button>
              );
            })}
          </div>
        )}
        {selectedSchools.length > 0 && (
          <ul className="fee-calculator__selected" aria-label="Selected schools">
            {selectedSchools.map((school) => (
              <li key={school.school_id}>
                {school.school_name}
                <button type="button" onClick={() => toggleSchool(school)} aria-label={`Remove ${school.school_name}`}>
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="fee-calculator__message fee-calculator__message--error" role="alert">{error}</p>}
        <button className="fee-calculator__submit" type="submit" disabled={estimating || Boolean(catalogError)}>
          {estimating ? "Calculating…" : "Compare published fees"} <ArrowRight size={16} aria-hidden />
        </button>
      </form>

      {results && (
        <section className="fee-calculator__results" aria-labelledby="fee-results-title">
          <h2 id="fee-results-title">Estimate comparison</h2>
          <p>These are estimates from published fee items for each selected grade and school type.</p>
          <div className="fee-calculator__result-grid">
            {results.map((result) => (
              <article className="fee-estimate-card" key={`${result.school_id}-${result.grade_id}`}>
                <h3>
                  <Link href={schoolProfilePathFromSlugs({
                    countrySlug: result.country_slug,
                    stateSlug: result.state_slug,
                    citySlug: result.city_slug,
                    localitySlug: result.location_slug,
                    schoolSlug: result.slug,
                    schoolName: result.school_name,
                  })}>
                    {result.school_name}
                  </Link>
                </h3>
                <p className="fee-estimate-card__year">{result.grade_name}</p>
                {result.stream && (
                  <p className="fee-estimate-card__year">{feeStreamLabel(result.stream)} stream</p>
                )}
                <p className="fee-estimate-card__year">
                  {result.academic_year ? `Academic year ${result.academic_year}` : "No active published fee schedule"}
                </p>
                {result.fees_available ? (
                  <>
                    <dl>
                      <div><dt>Annual estimate</dt><dd>{formatCurrency(result.annual_total)}</dd></div>
                      <div><dt>Monthly recurring estimate</dt><dd>{formatCurrency(result.monthly_recurring_total)}</dd></div>
                      <div><dt>First-year estimate</dt><dd>{formatCurrency(result.first_year_total)}</dd></div>
                    </dl>
                    {!result.complete && (
                      <p className="fee-estimate-card__note">
                        Some published charges are variable or could not be annualized. Known charges total{" "}
                        {formatCurrency(result.known_annual_subtotal)} per year; first-year total is not complete.
                      </p>
                    )}
                    <ul className="fee-estimate-card__items">
                      {result.items.map((item, index) => (
                        <li key={`${item.item_name}-${index}`}>
                          <span>{item.item_name}<small>{item.frequency.replaceAll("_", " ").toLowerCase()}</small></span>
                          <strong>{item.variable
                            ? "Variable / unavailable"
                            : formatCurrency(item.annualized_amount ?? item.one_time_amount)}</strong>
                        </li>
                      ))}
                    </ul>
                    {result.last_updated && (
                      <p className="fee-estimate-card__year">
                        Fee schedule updated{" "}
                        {new Date(result.last_updated).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="fee-estimate-card__note">
                    This school does not offer {result.grade_name} or the selected school type, or has no current published fee schedule.
                  </p>
                )}
              </article>
            ))}
          </div>
          <p className="fee-calculator__disclaimer">
            Confirm the final fee schedule, optional charges, and payment dates directly with each school.
          </p>
        </section>
      )}
    </main>
  );
}
