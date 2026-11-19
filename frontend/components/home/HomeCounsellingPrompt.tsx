"use client";

import { Phone } from "lucide-react";

export default function HomeCounsellingPrompt({ onBook }: { onBook: () => void }) {
  return (
    <section className="home-counsel-card" aria-labelledby="home-counsel-title">
      <span className="home-counsel-card__badge">Free for parents</span>
      <h2 id="home-counsel-title">Need help choosing the right school?</h2>
      <p>Talk to an admission counsellor and get a shortlist based on class, city, and school type.</p>
      <button type="button" onClick={onBook}>
        <Phone size={16} aria-hidden />
        Book expert counselling
      </button>
    </section>
  );
}
