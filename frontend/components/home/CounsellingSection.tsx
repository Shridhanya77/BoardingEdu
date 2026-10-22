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
import GradeMultiSelect from "./GradeMultiSelect";

export default function CounsellingSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [homeCity, setHomeCity] = useState("");
  const [cityChoices, setCityChoices] = useState<CityListItem[]>([]);
  const [preferred, setPreferred] = useState<CityListItem[]>([]);
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
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid WhatsApp number.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!selectedGrades.length) {
      setError("Please select at least one grade/class.");
      return;
    }
    if (preferred.length === 0) {
      setError("Please select at least one preferred city.");
      return;
    }
    setSubmitting(true);
    try {
      const allSameCountry = preferred.every((city) => city.country_id === preferred[0]!.country_id);
      const allSameState = preferred.every((city) => city.state_id === preferred[0]!.state_id);
      const result = await admissions.submitCounselling({
        parent_name: name.trim(),
        email: email.trim(),
        phone: digits,
        home_city: homeCity.trim(),
        preferred_country: allSameCountry ? preferred[0]!.country_id : undefined,
        preferred_state: allSameState ? preferred[0]!.state_id : undefined,
        preferred_cities: preferred.map((city) => city.city_id),
        grades: selectedGrades,
        boards: [],
        school_types: [],
        message: "",
      });
      setSuccess(result.reference);
      setName("");
      setEmail("");
      setPhone("");
      setSelectedGrades([]);
      setHomeCity("");
      setPreferred([]);
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
        <p>Tell us the class and city. A counsellor will call you back.</p>
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
            required
          />
        </label>
        <label>
          WhatsApp Number
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="98765 43210"
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </label>
        <GradeMultiSelect
          grades={grades}
          selectedIds={selectedGrades}
          onChange={setSelectedGrades}
          disabled={submitting}
        />
        {optionsError && <p className="counselling__error" role="alert">{optionsError}</p>}
        <label>
          City
          <select
            value={preferred[0]?.city_id ?? ""}
            required
            disabled={submitting}
            onChange={(event) => {
              const city = cityChoices.find((item) => item.city_id === event.target.value);
              setPreferred(city ? [city] : []);
              setHomeCity(city?.city_name ?? "");
            }}
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
          🔒 Your information is private and never shared without consent.
        </p>
      </form>
    </section>
  );
}
