import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy | BoardingEdu",
  description: "How BoardingEdu uses cookies and similar storage to keep search preferences and measure directory use.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="19 October 2026">
      <p>
        BoardingEdu uses necessary cookies and browser storage to keep location preferences, comparison
        selections, and login session data. Optional analytics storage is used only after you accept
        the consent prompt.
      </p>
      <p>
        You can clear stored data from your browser settings at any time.
      </p>
    </LegalPage>
  );
}
