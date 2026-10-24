"use client";

import { useState } from "react";
import { CalendarDays, LoaderCircle } from "lucide-react";
import { admissions, ApiError, type SchoolDetail } from "@/lib/api";
import { isValidEmailAddress, normalizePhoneNumber } from "@/lib/contact-validation";

function callbackErrorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    if (reason.status >= 500) {
      return "The callback service is temporarily unavailable. Please try again later.";
    }
    if (reason.body && typeof reason.body === "object" && !Array.isArray(reason.body)) {
      if ("detail" in reason.body && typeof reason.body.detail === "string") {
        return reason.body.detail;
      }
      const fieldMessages = Object.values(reason.body).flatMap((value) =>
        typeof value === "string"
          ? [value]
          : Array.isArray(value)
            ? value.filter((message): message is string => typeof message === "string")
            : [],
      );
      if (fieldMessages.length) return fieldMessages.join(" ");
    }
    return "We could not send your request. Please check the form and try again.";
  }
  return reason instanceof Error
    ? reason.message
    : "We could not send your callback request. Please try again.";
}

export default function SchoolCallbackForm({ school }: { school: SchoolDetail }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const grades = school.grades_offered_detail;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setReference(null);
    const phoneDigits = normalizePhoneNumber(phone);
    if (!phoneDigits) {
      setError("Enter your country code followed by exactly 10 phone number digits.");
      return;
    }
    if (!isValidEmailAddress(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!grades.some((grade) => grade.grade_id === gradeId)) {
      setError("Choose a grade listed for this school.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await admissions.submitCounselling({
        parent_name: name.trim(),
        email: email.trim(),
        phone: phoneDigits,
        home_city: school.city_detail.city_name,
        preferred_country: school.country_detail.country_id,
        preferred_state: school.state_detail.state_id,
        preferred_cities: [school.city_detail.city_id],
        grades: [gradeId],
        preferred_school: school.school_id,
        message: `Callback requested about ${school.school_name}.`,
      });
      setReference(result.reference);
      setName("");
      setEmail("");
      setPhone("");
      setGradeId("");
    } catch (reason: unknown) {
      setError(callbackErrorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="school-callback" aria-labelledby="school-callback-title">
      <div className="school-callback__intro">
        <span className="school-callback__icon"><CalendarDays size={20} aria-hidden /></span>
        <div>
          <h2 id="school-callback-title">Request a Callback</h2>
          <p>Ask us to call you about this school.</p>
        </div>
      </div>
      {grades.length ? (
        <form onSubmit={submit}>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
          <label>
            Email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            Phone number
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required />
          </label>
          <label>
            Grade
            <select value={gradeId} onChange={(event) => setGradeId(event.target.value)} required>
              <option value="">Choose a grade</option>
              {grades.map((grade) => (
                <option value={grade.grade_id} key={grade.grade_id}>{grade.grade_name}</option>
              ))}
            </select>
          </label>
          {error && <p className="school-callback__error" role="alert">{error}</p>}
          {reference && (
            <p className="school-callback__success" role="status">
              Your request was received. Reference: <strong>{reference}</strong>
            </p>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? <><LoaderCircle className="spin" size={17} /> Sending…</> : "Request a Callback"}
          </button>
        </form>
      ) : (
        <p className="school-callback__empty">
          This school has not published grade options yet. Please use the enquiry form to contact the school.
        </p>
      )}
    </section>
  );
}
