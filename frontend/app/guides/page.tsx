import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import GuideBrowser from "@/components/guides/GuideBrowser";
import { guideList, guidesIndexDescription } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import "./guides.css";

export const metadata: Metadata = pageMetadata({
  title: "School Admission Guides | BoardingEdu",
  description: guidesIndexDescription,
  path: "/guides",
  keywords: [
    "school admission guides",
    "boarding school tips",
    "how to choose a school",
    "CBSE ICSE IB IGCSE",
  ],
});

export default function GuidesIndexPage() {
  const guides = guideList();

  return (
    <main className="guides-page">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Guides", url: "/guides" },
        ])}
      />

      <header className="guides-hero">
        <p className="guides-eyebrow">GUIDES</p>
        <h1>Guides for families choosing a school</h1>
        <p className="guides-lead">
          Practical, jargon-free help for Indian school admissions — shortlisting with confidence,
          asking the right questions on a visit, understanding the boards, and planning the move to
          boarding life.
        </p>
      </header>

      <GuideBrowser guides={guides} />
    </main>
  );
}
