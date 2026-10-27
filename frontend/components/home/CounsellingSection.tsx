"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  admissions,
  ApiError,
  fetchAllPages,
  geography,
  schools,
  type CityListItem,
  type GradeListItem,
} from "@/lib/api";
import { isValidEmailAddress, normalizePhoneNumber } from "@/lib/contact-validation";
import CountryPhoneInput from "@/components/forms/CountryPhoneInput";

export default function CounsellingSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [cityChoices, setCityChoices] = useState<CityListItem[]>([]);
  const [cityId, setCityId] = useState("");
  const [grades, setGrades] = useState<GradeListItem[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      schools.grades().then((page) => fetchAllPages(page)),
      geography.cities().then((page) => fetchAllPages(page, 1000)),
    ])
      .then(([gradeRows, cityRows]) => {
        if (cancelled) return;
        setGrades(gradeRows.filter((row) => row.status));
        setCityChoices(
          cityRows
            .filter((row) => row.status)
            .sort((left, right) => left.city_name.localeCompare(right.city_name)),
        );
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
    if (!isValidEmailAddress(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!gradeId) {
      setError("Please select the class your child is applying for.");
      return;
    }
    const city = cityChoices.find((item) => item.city_id === cityId);
    if (!city) {
      setError("Please select at least one preferred city.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await admissions.submitCounselling({
        parent_name: name.trim(),
        email: email.trim(),
        phone: digits,
        home_city: city.city_name,
        preferred_country: city.country_id,
        preferred_state: city.state_id,
        preferred_cities: [city.city_id],
        grades: [gradeId],
        boards: [],
        school_types: [],
        message: "",
      });
      setSuccess(result.reference);
      setName("");
      setEmail("");
      setPhone("");
      setGradeId("");
      setCityId("");
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
        <p>Share your contact details, preferred city, and class. Our team will call you back.</p>
      </div>

      <form className="counselling__form" onSubmit={onSubmit}>
        <h3>Request a call</h3>

        <label>
          Your Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Ananya Kamath"
            autoComplete="name"
            required
          />
        </label>
        <label>
          Email Address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <CountryPhoneInput id="counselling-phone" label="WhatsApp Number" value={phone} onChange={setPhone} />
        <label>
          Class applying for
          <select
            value={gradeId}
            required
            disabled={submitting || !grades.length}
            onChange={(event) => setGradeId(event.target.value)}
          >
            <option value="">{grades.length ? "Choose a class" : "Loading classes…"}</option>
            {grades.map((grade) => (
              <option key={grade.grade_id} value={grade.grade_id}>{grade.grade_name}</option>
            ))}
          </select>
        </label>
        {optionsError && <p className="counselling__error" role="alert">{optionsError}</p>}
        <label>
          City
          <select
            value={cityId}
            required
            disabled={submitting || !cityChoices.length}
            onChange={(event) => setCityId(event.target.value)}
          >
            <option value="">{cityChoices.length ? "Choose a city" : "Loading cities…"}</option>
            {cityChoices.map((city) => (
              <option key={city.city_id} value={city.city_id}>
                {city.city_name}, {city.state_name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="counselling__error" role="alert">{error}</p>}
        {success && (
          <p className="counselling__ok" role="status">
            Request confirmed. Your counselling reference is <strong>{success}</strong>.
          </p>
        )}
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
