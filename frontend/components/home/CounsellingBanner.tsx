import Link from "next/link";
import { Phone } from "lucide-react";

export default function CounsellingBanner() {
  return (
    <section className="counselling-banner" aria-label="Free admission counselling">
      <div className="counselling-banner__copy">
        <span className="counselling-banner__badge">100% FREE</span>
        <div>
          <p>
            Need help choosing the <strong>right school</strong>?
          </p>
          <small>Talk to an admission counsellor and get a personalised shortlist.</small>
        </div>
      </div>
      <Link className="counselling-banner__action" href="/#counselling">
        <Phone size={16} aria-hidden />
        Book expert counselling
      </Link>
    </section>
  );
}
