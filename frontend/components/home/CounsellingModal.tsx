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
  type GradeListItem,
} from "@/lib/api";
import { isValidEmailAddress, normalizePhoneNumber } from "@/lib/contact-validation";

/**
 * Compact "request a callback" form opened from the navigation bar. It shares the
 * admissions endpoint with the home-page counselling section but stays deliberately
 * short: name, phone, email, class and a state-grouped preferred city, nothing else.
 */
export default function CounsellingModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cityId, setCityId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [grades, setGrades] = useState<GradeListItem[]>([]);
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
      geography.cities().then((page) => fetchAllPages(page)),
      schools.grades().then((page) => fetchAllPages(page)),
    ])
      .then(([cityRows, gradeRows]) => {
        if (!cancelled) {
          setCities(
            cityRows
              .filter((city) => city.status && city.country_code.toUpperCase() === "IN")
              .sort(
                (left, right) =>
                  left.state_name.localeCompare(right.state_name) ||
                  left.city_name.localeCompare(right.city_name),
              ),
          );
          setGrades(gradeRows.filter((grade) => grade.status));
          setOptionsError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setOptionsError(
            reason instanceof Error
              ? reason.message
              : "Counselling options could not be loaded.",
          );
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

  /** Cities grouped by state so the picker reads "state, then city" in one control. */
  const citiesByState = useMemo(() => {
    const groups = new Map<string, CityListItem[]>();
    for (const city of cities) {
      const bucket = groups.get(city.state_name);
      if (bucket) bucket.push(city);
      else groups.set(city.state_name, [city]);
    }
    return [...groups.entries()];
  }, [cities]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setReference(null);
    const city = cities.find((item) => item.city_id === cityId);
    const grade = grades.find((item) => item.grade_id === gradeId);
    const digits = normalizePhoneNumber(phone);
    if (!digits) {
      setError("Enter your country code followed by exactly 10 phone number digits.");
      return;
    }
    if (!isValidEmailAddress(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!city || !grade) {
      setError("Choose a preferred city and the class your child is applying for.");
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
        grades: [grade.grade_id],
        message: "Requested a callback from the navigation bar.",
      });
      setReference(result.reference);
      setName("");
      setEmail("");
      setPhone("");
      setCityId("");
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
        if (event.target === event.currentTarget) onClose();
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
        <button
          className="counselling-modal__close"
          type="button"
          aria-label="Close callback form"
          onClick={onClose}
        >
          <X size={18} aria-hidden />
        </button>
        <span className="counselling-modal__eyebrow">FREE CALLBACK</span>
        <h2 id="counselling-modal-title">Request a callback</h2>
        <p>Five quick details and a counsellor calls you back.</p>

        {loading ? (
          <div className="counselling-modal__loading" role="status">
            <LoaderCircle className="spin" size={18} /> Loading options…
          </div>
        ) : optionsError ? (
          <p className="counselling-modal__error" role="alert">{optionsError}</p>
        ) : !cities.length || !grades.length ? (
          <p className="counselling-modal__error" role="alert">
            Callback requests are not available right now. Please try again later.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Your name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label>
              Phone number
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                required
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Class applying for
              <select value={gradeId} onChange={(event) => setGradeId(event.target.value)} required>
                <option value="">Choose a class</option>
                {grades.map((grade) => (
                  <option value={grade.grade_id} key={grade.grade_id}>{grade.grade_name}</option>
                ))}
              </select>
            </label>
            <label className="counselling-modal__wide">
              Preferred city
              <select value={cityId} onChange={(event) => setCityId(event.target.value)} required>
                <option value="">State, then city</option>
                {citiesByState.map(([stateName, stateCities]) => (
                  <optgroup label={stateName} key={stateName}>
                    {stateCities.map((city) => (
                      <option value={city.city_id} key={city.city_id}>
                        {city.city_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {error && <p className="counselling-modal__error" role="alert">{error}</p>}
            {reference && (
              <p className="counselling-modal__success" role="status">
                Callback requested. Your reference is <strong>{reference}</strong>.
              </p>
            )}
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending request…" : "Request callback"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
