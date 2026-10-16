"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { fetchAllPages, geography, schools, type CityListItem, type GradeListItem } from "@/lib/api";

const LEAD_KEY = "boardingeu:counselling-leads";

export default function CounsellingSection() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [cityHits, setCityHits] = useState<CityListItem[]>([]);
  const [preferred, setPreferred] = useState<CityListItem[]>([]);
  const [grades, setGrades] = useState<GradeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    schools
      .grades()
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (!cancelled) setGrades(rows.filter((row) => row.status));
      })
      .catch(() => {
        if (!cancelled) setGrades([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = cityQuery.trim();
    if (query.length < 2) {
      setCityHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      geography
        .searchCities(query)
        .then((page) => {
          if (!cancelled) {
            setCityHits(
              page.results.filter(
                (city) =>
                  city.status && !preferred.some((item) => item.city_id === city.city_id)
              )
            );
          }
        })
        .catch(() => {
          if (!cancelled) setCityHits([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cityQuery, preferred]);

  const selectedNames = useMemo(
    () => preferred.map((city) => city.city_name).join(", "),
    [preferred]
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid WhatsApp number.");
      return;
    }
    if (!grade) {
      setError("Please select your child's grade.");
      return;
    }
    if (preferred.length === 0) {
      setError("Please select at least one preferred city.");
      return;
    }
    setSubmitting(true);
    try {
      const lead = {
        name: name.trim(),
        phone: digits,
        grade,
        homeCity: homeCity.trim(),
        preferredCities: preferred.map((city) => city.city_name),
        createdAt: new Date().toISOString(),
      };
      const existing = JSON.parse(window.localStorage.getItem(LEAD_KEY) ?? "[]") as unknown;
      const next = Array.isArray(existing) ? [...existing, lead] : [lead];
      window.localStorage.setItem(LEAD_KEY, JSON.stringify(next));
      setSuccess(true);
      setName("");
      setPhone("");
      setGrade("");
      setHomeCity("");
      setPreferred([]);
      setCityQuery("");
    } catch {
      setError("We could not save your request on this device. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="home-section counselling" id="counselling">
      <div className="counselling__intro">
        <div className="section-eyebrow">100% FREE SERVICE</div>
        <h2>Get Free One-on-One Admission Counselling</h2>
        <p>
          Our expert counsellors connect with you to provide personalised guidance on school
          selection, fee structures, board differences, and everything you need for a confident
          admission decision.
        </p>
        <ul>
          <li>
            <span>🎓</span>
            <div>
              <strong>Expert Board Guidance</strong>
              <p>CBSE, ICSE, IB, Cambridge — understand every board difference.</p>
            </div>
          </li>
          <li>
            <span>🏫</span>
            <div>
              <strong>Personalised School Matching</strong>
              <p>We narrow 12,000 schools down to your best-fit shortlist.</p>
            </div>
          </li>
          <li>
            <span>📋</span>
            <div>
              <strong>Application & Document Support</strong>
              <p>Forms, deadlines, fee planning, and admission strategy.</p>
            </div>
          </li>
        </ul>
        <div className="counselling__admin">
          <strong>BoardingEdu Admin</strong>
          <span>Contact: 91xxxxxxxx</span>
        </div>
      </div>

      <form className="counselling__form" onSubmit={onSubmit}>
        <h3>Book Free Counselling</h3>
        <p>Share your details to request personalised guidance.</p>

        <label>
          Your Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Ananya Kamath"
            autoComplete="name"
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
          />
        </label>
        <label>
          Child&apos;s Grade
          <select value={grade} onChange={(event) => setGrade(event.target.value)}>
            <option value="">Select grade</option>
            {grades.map((item) => (
              <option key={item.grade_id} value={item.grade_name}>
                {item.grade_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Home City
          <input
            value={homeCity}
            onChange={(event) => setHomeCity(event.target.value)}
            placeholder="e.g. Mumbai"
          />
        </label>
        <div className="counselling__cities">
          <span>Preferred Cities *</span>
          <input
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
            placeholder="Search and select multiple cities"
          />
          {preferred.length > 0 && (
            <div className="counselling__picked">
              {preferred.map((city) => (
                <button
                  type="button"
                  key={city.city_id}
                  onClick={() =>
                    setPreferred((current) =>
                      current.filter((item) => item.city_id !== city.city_id)
                    )
                  }
                >
                  {city.city_name} ×
                </button>
              ))}
            </div>
          )}
          {cityHits.length > 0 && (
            <div className="finder-menu counselling__hits">
              {cityHits.map((city) => (
                <button
                  type="button"
                  key={city.city_id}
                  onClick={() => {
                    setPreferred((current) => [...current, city]);
                    setCityQuery("");
                    setCityHits([]);
                  }}
                >
                  {city.city_name}
                  <small>{city.state_name}</small>
                </button>
              ))}
            </div>
          )}
          {selectedNames && <p className="sr-only">Selected: {selectedNames}</p>}
        </div>

        {error && <p className="counselling__error" role="alert">{error}</p>}
        {success && (
          <p className="counselling__ok" role="status">
            Thank you. A counsellor will reach you on WhatsApp shortly.
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
