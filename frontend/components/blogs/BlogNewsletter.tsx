"use client";

import { FormEvent, useState } from "react";
import { ApiError, blogs } from "@/lib/api";
import TurnstileWidget from "@/components/TurnstileWidget";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BlogNewsletter() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!consent) {
      setError("Please confirm that you want education updates.");
      return;
    }
    setPending(true);
    try {
      const result = await blogs.subscribe(normalized, true, turnstileToken);
      setMessage(
        result.already_subscribed
          ? "This email is already subscribed to BoardingEdu updates."
          : "You are subscribed. We will send occasional education updates.",
      );
      setEmail("");
      setConsent(false);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 429) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("We could not save that subscription. Check the email and try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="blogs-newsletter" aria-labelledby="blogs-newsletter-title">
      <div>
        <p className="blogs-eyebrow">Updates</p>
        <h2 id="blogs-newsletter-title">Education notes for parents</h2>
        <p>
          Occasional articles on admissions, school choices, and student life. No school is contacted
          when you subscribe.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="blog-newsletter-email">Email address</label>
        <input
          id="blog-newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label className="blogs-newsletter__consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>I agree to receive education updates from BoardingEdu. I can unsubscribe later.</span>
        </label>
        <TurnstileWidget onToken={setTurnstileToken} />
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Subscribe"}
        </button>
        {message ? <p role="status">{message}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </section>
  );
}
