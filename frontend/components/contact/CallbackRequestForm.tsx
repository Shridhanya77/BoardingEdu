"use client";

import { useState } from "react";
import { LoaderCircle, PhoneCall } from "lucide-react";
import { admissions, apiErrorMessage } from "@/lib/api";
import { normalizePhoneNumber } from "@/lib/contact-validation";
import CountryPhoneInput from "@/components/forms/CountryPhoneInput";

export default function CallbackRequestForm({ titleId }: { titleId: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setReference(null);

    const phoneDigits = normalizePhoneNumber(phone);
    if (!name.trim()) {
      setError("Enter your name so we know who to ask for.");
      return;
    }
    if (!phoneDigits) {
      setError("Enter your country code followed by exactly 10 phone number digits.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await admissions.submitCounselling({
        parent_name: name.trim(),
        phone: phoneDigits,
        preferred_cities: [],
        grades: [],
        message: "Callback requested from the website.",
      });
      setReference(result.reference);
      setName("");
      setPhone("");
    } catch (reason: unknown) {
      setError(apiErrorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="callback-request" aria-labelledby={titleId}>
      <div className="callback-request__heading">
        <span className="callback-request__icon" aria-hidden="true">
          <PhoneCall size={20} />
        </span>
        <div>
          <span className="callback-request__eyebrow">WE’RE HERE TO HELP</span>
          <h2 id={titleId}>Request a callback</h2>
          <p>Leave your name and number. Our team will get in touch.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <label>
          Your name
          <input
            type="text"
            autoComplete="name"
            maxLength={150}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={submitting}
            required
          />
        </label>
        <CountryPhoneInput
          id={`${titleId}-phone`}
          label="Phone number"
          value={phone}
          onChange={setPhone}
          disabled={submitting}
        />
        {error && <p className="callback-request__error" role="alert">{error}</p>}
        {reference && (
          <p className="callback-request__success" role="status">
            Thanks. Your callback request is in, and its reference is <strong>{reference}</strong>.
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? (
            <><LoaderCircle className="spin" size={17} /> Sending request…</>
          ) : (
            "Request a Callback"
          )}
        </button>
      </form>
    </section>
  );
}
