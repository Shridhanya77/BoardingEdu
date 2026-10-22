import { Phone } from "lucide-react";
import CounsellingLink from "@/components/home/CounsellingLink";

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
      <CounsellingLink className="counselling-banner__action">
        <Phone size={16} aria-hidden />
        Book expert counselling
      </CounsellingLink>
    </section>
  );
}
