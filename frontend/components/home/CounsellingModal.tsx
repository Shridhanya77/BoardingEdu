"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, LoaderCircle, X } from "lucide-react";
import {
  admissions,
  ApiError,
  fetchAllPages,
  geography,
  schools,
  type CityListItem,
  type GradeListItem,
  type SchoolTypeListItem,
  type StateListItem,
} from "@/lib/api";
import { isValidEmailAddress, normalizePhoneNumber } from "@/lib/contact-validation";
import CountryPhoneInput from "@/components/forms/CountryPhoneInput";
import CounsellingLocationMultiSelect from "@/components/home/CounsellingLocationMultiSelect";
import { gradeSelectOptions } from "@/lib/grade-labels";
import { homeSchoolTypeIds, toSeoSlug, type HomeSchoolCategory } from "@/lib/seo-slugs";

export default function CounsellingModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [schoolCategory, setSchoolCategory] = useState<HomeSchoolCategory>("residential-school");
  const [countryId, setCountryId] = useState("");
  const [stateIds, setStateIds] = useState<string[]>([]);
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [gradeId, setGradeId] = useState("");
  const [states, setStates] = useState<StateListItem[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [grades, setGrades] = useState<GradeListItem[]>([]);
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    let cancelled = false;
    Promise.all([
      geography.countries().then((page) => fetchAllPages(page)),
      geography.cities().then((page) => fetchAllPages(page)),
      schools.grades().then((page) => fetchAllPages(page)),
      schools.types().then((page) => fetchAllPages(page)),
    ])
      .then(([countryRows, cityRows, gradeRows, typeRows]) => {
        if (cancelled) return;
        const activeCountries = countryRows.filter((country) => country.status);
        const india = activeCountries.find((country) => toSeoSlug(country.slug || country.country_name) === "india");
        if (india) setCountryId(india.country_id);
        setCities(cityRows.filter((city) => city.status));
        setGrades(gradeRows.filter((grade) => grade.status));
        setSchoolTypes(typeRows.filter((type) => type.status));
        setOptionsError(null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setOptionsError(reason instanceof Error ? reason.message : "Counselling options could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStatesError(null);
      return;
    }
    let cancelled = false;
    setStatesLoading(true);
    setStatesError(null);
    geography.statesOf(countryId)
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (!cancelled) setStates(rows.filter((state) => state.status && state.country_id === countryId));
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setStates([]);
          setStatesError(reason instanceof Error ? reason.message : "States could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  const countryCities = useMemo(() => {
    return cities
      .filter((city) => city.country_id === countryId)
      .sort((left, right) => left.city_name.localeCompare(right.city_name));
  }, [cities, countryId]);
  const selectedStates = useMemo(
    () => states.filter((state) => stateIds.includes(state.state_id)),
    [stateIds, states],
  );
  const selectedCities = useMemo(
    () => countryCities.filter((city) => cityIds.includes(city.city_id)),
    [cityIds, countryCities],
  );
  const boarding = schoolCategory === "residential-school";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setReference(null);
    const digits = normalizePhoneNumber(phone);
    if (!digits) {
      setError("Enter your country code followed by exactly 10 phone number digits.");
      return;
    }
    if (email.trim() && !isValidEmailAddress(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!selectedStates.length) {
      setError("Choose at least one state for counselling.");
      return;
    }
    if (!boarding && !selectedCities.length) {
      setError("Choose at least one city for day school counselling.");
      return;
    }
    if (!gradeId) {
      setError("Choose the class your child is applying for.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await admissions.submitCounselling({
        parent_name: name.trim(),
        email: email.trim(),
        phone: digits,
        home_city: selectedCities[0]?.city_name ?? selectedStates[0].state_name,
        preferred_country: countryId || selectedStates[0].country_id,
        preferred_state: selectedStates[0].state_id,
        preferred_states: selectedStates.map((state) => state.state_id),
        preferred_cities: selectedCities.map((city) => city.city_id),
        grades: [gradeId],
        school_types: homeSchoolTypeIds(schoolTypes, schoolCategory),
      });
      setReference(result.reference);
      setName("");
      setEmail("");
      setPhone("");
      setCityIds([]);
      setStateIds([]);
      setGradeId("");
    } catch (reason: unknown) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : reason instanceof Error
            ? reason.message
            : "We could not submit your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="counselling-modal__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="counselling-modal counselling-modal--quick"
        role="dialog"
        aria-modal="true"
        aria-labelledby="counselling-modal-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <button className="counselling-modal__close" type="button" aria-label="Close counselling form" onClick={onClose}>
          <X size={18} aria-hidden />
        </button>
        <span className="counselling-modal__eyebrow">GET COUNSELLING</span>
        <h2 id="counselling-modal-title">Request counselling</h2>
        <p>Tell us how to reach you and where you want to look. Required fields are marked.</p>

        {loading ? (
          <div className="counselling-modal__loading" role="status">
            <LoaderCircle className="spin" size={18} /> Loading options…
          </div>
        ) : optionsError ? (
          <p className="counselling-modal__error" role="alert">{optionsError}</p>
        ) : reference ? (
          <section className="counselling-modal__confirmation" role="status" aria-labelledby="counselling-confirmation-title">
            <CheckCircle2 size={32} aria-hidden />
            <h3 id="counselling-confirmation-title">Application submitted</h3>
            <p>Your counselling request has been submitted successfully. Our team will contact you soon.</p>
            <p className="counselling-modal__success">Reference: <strong>{reference}</strong></p>
            <button type="button" onClick={onClose}>Done</button>
          </section>
        ) : (
          <form onSubmit={submit}>
            <label>
              <span>Parent name <span aria-hidden="true">*</span></span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Parent's full name" autoComplete="name" enterKeyHint="next" required disabled={submitting} />
            </label>
            <CountryPhoneInput id="counselling-modal-phone" label="Phone number *" value={phone} onChange={setPhone} disabled={submitting} />
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" enterKeyHint="next" maxLength={254} disabled={submitting} />
            </label>
            <label>
              <span>School type <span aria-hidden="true">*</span></span>
              <select
                value={schoolCategory}
                disabled={submitting}
                onChange={(event) => setSchoolCategory(event.target.value as HomeSchoolCategory)}
              >
                <option value="residential-school">Boarding School</option>
                <option value="day-school">Day School</option>
              </select>
            </label>
            <CounsellingLocationMultiSelect
              states={states}
              cities={countryCities}
              selectedStateIds={stateIds}
              selectedCityIds={cityIds}
              onStatesChange={setStateIds}
              onCitiesChange={setCityIds}
              disabled={submitting || !countryId || statesLoading}
              citiesRequired={!boarding}
            />
            {statesError && <p className="counselling-modal__error" role="alert">{statesError}</p>}
            <label>
              <span>Class applying for <span aria-hidden="true">*</span></span>
              <select value={gradeId} onChange={(event) => setGradeId(event.target.value)} required disabled={submitting}>
                <option value="">Choose a class</option>
                {gradeSelectOptions(grades).map((grade) => (
                  <option value={grade.grade_id} key={grade.grade_id}>{grade.grade_name}</option>
                ))}
              </select>
            </label>
            {error && <p className="counselling-modal__error" role="alert">{error}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending request…" : "Get counselling"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
