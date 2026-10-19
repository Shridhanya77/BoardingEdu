import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Use | BoardingEdu",
  description: "Terms for using BoardingEdu to explore schools, compare listings, and request admission counselling.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="19 October 2026">
      <p>
        By using BoardingEdu you agree to use the directory for personal school research. Listings,
        fees, and admission details can change. Confirm important information with each school.
      </p>
      <h2>Our role</h2>
      <p>
        BoardingEdu is a discovery and counselling platform. We do not guarantee admission, seats,
        or the accuracy of every school-supplied field.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not misuse forms, scrape the service in a way that disrupts other users, or submit false
        contact details.
      </p>
    </LegalPage>
  );
}
