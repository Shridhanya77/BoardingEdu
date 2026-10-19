import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
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

      <section className="guides-grid" aria-label="Guides">
        {guides.map((guide) => (
          <article key={guide.slug} className="guides-card">
            <span className="guides-chip">{guide.category}</span>
            <h2 className="guides-card__title">
              <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
            </h2>
            <p className="guides-card__summary">{guide.summary}</p>
            <div className="guides-card__foot">
              <span className="guides-card__time">{guide.readingMinutes} min read</span>
              <Link className="guides-card__link" href={`/guides/${guide.slug}`}>
                Read guide
                <span aria-hidden="true"> →</span>
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
