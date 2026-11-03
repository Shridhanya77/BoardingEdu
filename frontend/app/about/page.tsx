import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About Us | BoardingEdu",
  description: "BoardingEdu helps families compare day schools and boarding schools across India.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <LegalPage title="About Us" updated="3 November 2026">
      <p>
        BoardingEdu is a school discovery platform for families comparing day schools and boarding
        schools. Listings, locations, and filters come from the published school directory.
      </p>
      <p>
        Start with <Link href="/india/">Explore Schools in India</Link>, narrow by state or city, and
        open a school profile for fees, boards, and admission details.
      </p>
      <p>
        For a callback, use <Link href="/contact/">Contact Us</Link> or the counselling form.
      </p>
    </LegalPage>
  );
}
