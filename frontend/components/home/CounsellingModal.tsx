"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import {
  admissions,
  ApiError,
  fetchAllPages,
  geography,
  schools,
  type CityListItem,
  type CountryListItem,
  type GradeListItem,
  type SchoolTypeListItem,
  type StateListItem,
} from "@/lib/api";
import { isValidEmailAddress, normalizePhoneNumber } from "@/lib/contact-validation";
import CountryPhoneInput from "@/components/forms/CountryPhoneInput";
import { indiaRegionForState, INDIA_REGIONS } from "@/lib/india-regions";
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
  const [message, setMessage] = useState("");
  const [schoolCategory, setSchoolCategory] = useState<HomeSchoolCategory>("residential-school");
  const [countryId, setCountryId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [states, setStates] = useState<StateListItem[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
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
        setCountries(activeCountries);
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
      return;
    }
    let cancelled = false;
    setStatesLoading(true);
    geography.statesOf(countryId)
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (!cancelled) setStates(rows.filter((state) => state.status && state.country_id === countryId));
      })
      .catch(() => {
        if (!cancelled) setStates([]);
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  const isIndia = countries.some((country) => country.country_id === countryId && toSeoSlug(country.slug || country.country_name) === "india");
  const regionStates = useMemo(() => {
    return states.filter((state) => {
      if (!isIndia || !regionId) return true;
      return indiaRegionForState(state.state_name, state.slug)?.id === regionId;
    });
  }, [isIndia, regionId, states]);
  const dayCities = useMemo(() => {
    return cities
      .filter((city) => !stateId || city.state_id === stateId)
      .sort((left, right) => left.city_name.localeCompare(right.city_name));
  }, [cities, stateId]);
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
    if (!isValidEmailAddress(email)) {
      setError("Enter a valid email address.");
      return;
    }
    const state = states.find((item) => item.state_id === stateId);
    const city = cities.find((item) => item.city_id === cityId);
    if (boarding && !state) {
      setError("Choose a state for boarding school counselling.");
      return;
    }
    if (!boarding && !city) {
      setError("Choose a city for day school counselling.");
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
        home_city: boarding ? state?.state_name ?? "" : city?.city_name ?? "",
        preferred_country: countryId || city?.country_id || state?.country_id,
        preferred_state: state?.state_id || city?.state_id,
        preferred_cities: city && !boarding ? [city.city_id] : [],
        grades: [gradeId],
        school_types: homeSchoolTypeIds(schoolTypes, schoolCategory),
        message: [
          message.trim(),
          boarding ? "School type: Boarding School. Tehsil records are not published for this state, so no tehsil was selected." : "School type: Day School.",
        ].filter(Boolean).join("\n"),
      });
      setReference(result.reference);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setCityId("");
      setStateId("");
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
        ) : (
          <form onSubmit={submit}>
            <label>
              Parent name <span aria-hidden="true">*</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required disabled={submitting} />
            </label>
            <CountryPhoneInput id="counselling-modal-phone" label="Phone number *" value={phone} onChange={setPhone} disabled={submitting} />
            <label>
              Email <span aria-hidden="true">*</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required disabled={submitting} />
            </label>
            <label>
              School type <span aria-hidden="true">*</span>
              <select
                value={schoolCategory}
                disabled={submitting}
                onChange={(event) => {
                  setSchoolCategory(event.target.value as HomeSchoolCategory);
                  setCityId("");
                  setStateId("");
                }}
              >
                <option value="residential-school">Boarding School</option>
                <option value="day-school">Day School</option>
              </select>
            </label>
            <label>
              Country
              <select
                value={countryId}
                disabled={submitting}
                onChange={(event) => {
                  setCountryId(event.target.value);
                  setRegionId("");
                  setStateId("");
                  setCityId("");
                }}
              >
                <option value="">Choose a country</option>
                {countries.map((country) => (
                  <option key={country.country_id} value={country.country_id}>{country.country_name}</option>
                ))}
              </select>
            </label>
            {isIndia && (
              <label>
                Region
                <select
                  value={regionId}
                  disabled={submitting || statesLoading}
                  onChange={(event) => {
                    setRegionId(event.target.value);
                    setStateId("");
                    setCityId("");
                  }}
                >
                  <option value="">{statesLoading ? "Loading regions…" : "All regions"}</option>
                  {INDIA_REGIONS.map((region) => (
                    <option key={region.id} value={region.id}>{region.label}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              State {boarding && <span aria-hidden="true">*</span>}
              <select
                value={stateId}
                required={boarding}
                disabled={submitting || !countryId || statesLoading}
                onChange={(event) => {
                  setStateId(event.target.value);
                  setCityId("");
                }}
              >
                <option value="">{statesLoading ? "Loading states…" : "Choose a state"}</option>
                {regionStates.map((state) => (
                  <option key={state.state_id} value={state.state_id}>{state.state_name}</option>
                ))}
              </select>
            </label>
            {boarding ? (
              <label>
                Tehsil
                <select value="" disabled aria-describedby="tehsil-note">
                  <option value="">{stateId ? "No tehsils published" : "Choose a state first"}</option>
                </select>
                <small id="tehsil-note">
                  {stateId
                    ? "This state has no tehsil records in the directory. Cities and localities are not used here."
                    : "Tehsils load only after a state is selected."}
                </small>
              </label>
            ) : (
              <label>
                City <span aria-hidden="true">*</span>
                <select value={cityId} required disabled={submitting} onChange={(event) => setCityId(event.target.value)}>
                  <option value="">Choose a city</option>
                  {dayCities.map((city) => (
                    <option key={city.city_id} value={city.city_id}>{city.city_name}, {city.state_name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Preferred class <span aria-hidden="true">*</span>
              <select value={gradeId} onChange={(event) => setGradeId(event.target.value)} required disabled={submitting}>
                <option value="">Choose a class</option>
                {grades.map((grade) => (
                  <option value={grade.grade_id} key={grade.grade_id}>{grade.grade_name}</option>
                ))}
              </select>
            </label>
            <label className="counselling-modal__wide">
              Additional message
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} disabled={submitting} />
            </label>
            {error && <p className="counselling-modal__error" role="alert">{error}</p>}
            {reference && (
              <p className="counselling-modal__success" role="status">
                Request received. Your reference is <strong>{reference}</strong>.
              </p>
            )}
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
