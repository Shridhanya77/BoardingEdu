import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy | BoardingEdu",
  description: "How BoardingEdu collects, uses, and protects information when families search schools and request counselling.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="19 October 2026">
      <p>
        BoardingEdu collects the information you submit on this website so we can show school listings,
        send enquiries, and connect you with counselling. School profile content is provided for discovery
        and should be confirmed with the school before an admission decision.
      </p>
      <h2>Information we collect</h2>
      <p>
        Enquiry and counselling forms may include your name, email, phone number, preferred locations,
        grades, and school preferences. Account details are stored only if you create an account.
      </p>
      <h2>How we use it</h2>
      <p>
        We use this information to operate the directory, respond to requests, improve search, and contact
        you about schools you asked about. We do not sell personal information.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this policy can be sent to <a href="mailto:hello@boardingedu.com">hello@boardingedu.com</a>.
      </p>
    </LegalPage>
  );
}
