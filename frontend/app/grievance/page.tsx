import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { SITE_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Grievance Policy | BoardingEdu",
  description: "How to raise a complaint about BoardingEdu school listings, counselling, or account information.",
  path: "/grievance",
});

export default function GrievancePage() {
  return (
    <LegalPage title="Grievance Policy" updated="19 October 2026">
      <p>
        If a listing looks incorrect, an enquiry was not handled, or you want personal information
        reviewed, email <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a> with the page
        URL and a short description of the issue.
      </p>
      <p>
        We aim to acknowledge grievances within seven working days and follow up until the issue is
        resolved or explained.
      </p>
    </LegalPage>
  );
}
