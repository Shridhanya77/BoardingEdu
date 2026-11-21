"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  admissions,
  ApiError,
  fetchAllPages,
  geography,
  schools,
  type CityListItem,
  type GradeListItem,
  type StateListItem,
} from "@/lib/api";
import { isValidEmailAddress, normalizePhoneNumber } from "@/lib/contact-validation";
import CountryPhoneInput from "@/components/forms/CountryPhoneInput";
import CounsellingLocationMultiSelect from "@/components/home/CounsellingLocationMultiSelect";
import { gradeSelectOptions } from "@/lib/grade-labels";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useToast } from "@/components/ui/Toast";

export default function CounsellingSection() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [stateChoices, setStateChoices] = useState<StateListItem[]>([]);
  const [cityChoices, setCityChoices] = useState<CityListItem[]>([]);
  const [stateIds, setStateIds] = useState<string[]>([]);
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [grades, setGrades] = useState<GradeListItem[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      schools.grades().then((page) => fetchAllPages(page)),
      geography.countries().then((page) => fetchAllPages(page)),
      geography.states().then((page) => fetchAllPages(page, 1000)),
      geography.cities().then((page) => fetchAllPages(page, 1000)),
    ])
      .then(([gradeRows, countryRows, stateRows, cityRows]) => {
        if (cancelled) return;
        setGrades(gradeRows.filter((row) => row.status));
        const activeCountries = countryRows.filter((row) => row.status);
        const india = activeCountries.find((country) => country.country_name.toLowerCase() === "india");
        setCountryId(india?.country_id ?? activeCountries[0]?.country_id ?? "");
        setStateChoices(
          stateRows
            .filter((row) => row.status)
            .sort((left, right) => left.state_name.localeCompare(right.state_name)),
        );
        setCityChoices(cityRows
          .filter((row) => row.status)
          .sort((left, right) => left.city_name.localeCompare(right.city_name)));
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setOptionsError(reason instanceof Error ? reason.message : "Could not load counselling options.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableStates = useMemo(
    () => stateChoices.filter((state) => state.country_id === countryId),
    [countryId, stateChoices],
  );
  const availableCities = useMemo(
    () => cityChoices.filter((city) => city.country_id === countryId),
    [cityChoices, countryId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const digits = normalizePhoneNumber(phone);
    if (!digits) {
      setError("Enter your country code followed by exactly 10 phone number digits.");
      return;
    }
    if (email.trim() && !isValidEmailAddress(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!gradeId) {
      setError("Please select the class your child is applying for.");
      return;
    }
    const selectedStates = availableStates.filter((state) => stateIds.includes(state.state_id));
    if (!selectedStates.length) {
      setError("Please select at least one preferred state.");
      return;
    }
    const selectedCities = availableCities.filter((city) => cityIds.includes(city.city_id));
    if (!selectedCities.length) {
      setError("Please select at least one preferred city.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await admissions.submitCounselling({
        parent_name: name.trim(),
        email: email.trim(),
        phone: digits,
        home_city: selectedCities[0].city_name,
        preferred_country: countryId,
        preferred_state: selectedStates[0].state_id,
        preferred_states: selectedStates.map((state) => state.state_id),
        preferred_cities: selectedCities.map((city) => city.city_id),
        grades: [gradeId],
        boards: [],
        school_types: [],
        message: "",
        cf_turnstile_token: turnstileToken,
      });
      setSuccess(result.reference);
      toast(`Your counselling request has been submitted successfully. Reference: ${result.reference}.`, "success");
      setName("");
      setEmail("");
      setPhone("");
      setGradeId("");
      setStateIds([]);
      setCityIds([]);
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

  return (
    <section className="home-section counselling" id="counselling">
      <div className="counselling__intro">
        <div className="section-eyebrow">100% FREE SERVICE</div>
        <h2>Free admission counselling</h2>
        <p>Share your contact details, preferred locations, and class. Our team will call you back.</p>
      </div>

      <form className="counselling__form" onSubmit={onSubmit}>
        <h3>Request a call</h3>
        <p>Share a few details and our counsellor will call you back. Fields marked * are required.</p>

        <label>
          <span>Your name <span aria-hidden="true">*</span></span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Parent's full name"
            autoComplete="name"
            enterKeyHint="next"
            required
            disabled={submitting}
          />
        </label>
        <label>
          <span>Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            maxLength={254}
            disabled={submitting}
          />
        </label>
        <CountryPhoneInput
          id="counselling-phone"
          label="WhatsApp number *"
          value={phone}
          onChange={setPhone}
          disabled={submitting}
        />
        <CounsellingLocationMultiSelect
          states={availableStates}
          cities={availableCities}
          selectedStateIds={stateIds}
          selectedCityIds={cityIds}
          onStatesChange={setStateIds}
          onCitiesChange={setCityIds}
          disabled={submitting || !countryId}
        />
        <label>
          <span>Class applying for <span aria-hidden="true">*</span></span>
          <select
            value={gradeId}
            required
            disabled={submitting || !grades.length}
            onChange={(event) => setGradeId(event.target.value)}
          >
            <option value="">{optionsError ? "Classes unavailable" : grades.length ? "Choose a class" : "Loading classes…"}</option>
            {gradeSelectOptions(grades).map((grade) => (
              <option key={grade.grade_id} value={grade.grade_id}>{grade.grade_name}</option>
            ))}
          </select>
        </label>
        {optionsError && <p className="counselling__error" role="alert">{optionsError}</p>}
        {error && <p className="counselling__error" role="alert">{error}</p>}
        {success && (
          <p className="counselling__ok" role="status">
            Request confirmed. Your counselling reference is <strong>{success}</strong>.
          </p>
        )}
        <TurnstileWidget onToken={setTurnstileToken} />
        <button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Get Free Counselling →"}
        </button>
        <p className="counselling__lock">
          We use your details only to respond to this counselling request.
        </p>
      </form>
    </section>
  );
}
