import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import CounsellingLink from "@/components/home/CounsellingLink";
import { getGuide, guides, guidesIndexDescription, relatedGuides } from "@/lib/guides";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import "../guides.css";

type GuidePageProps = { params: { slug: string } };

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export function generateMetadata({ params }: GuidePageProps): Metadata {
  const guide = getGuide(params.slug);
  if (!guide) {
    return pageMetadata({
      title: "Guide not found | BoardingEdu",
      description: guidesIndexDescription,
      path: `/guides/${params.slug}`,
      index: false,
    });
  }
  return pageMetadata({
    title: `${guide.title} | BoardingEdu`,
    description: guide.summary,
    path: `/guides/${guide.slug}`,
    keywords: [guide.category, guide.title],
  });
}

function formatUpdated(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function GuidePage({ params }: GuidePageProps) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const related = relatedGuides(guide.slug);
  const path = `/guides/${guide.slug}`;
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Guides", url: "/guides" },
    { name: guide.title, url: path },
  ];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    datePublished: guide.updated,
    dateModified: guide.updated,
    mainEntityOfPage: absoluteUrl(path),
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <main className="guides-page">
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />

      <nav className="guides-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/guides">Guides</Link>
          </li>
          <li aria-current="page">{guide.title}</li>
        </ol>
      </nav>

      <div className="guides-layout">
        <article className="guides-article">
          <span className="guides-chip">{guide.category}</span>
          <h1>{guide.title}</h1>
          <p className="guides-meta">
            <span>Updated {formatUpdated(guide.updated)}</span>
            <span aria-hidden="true"> · </span>
            <span>{guide.readingMinutes} min read</span>
            <span aria-hidden="true"> · </span>
            <span>{guide.category}</span>
          </p>

          {guide.sections.map((section) => (
            <section key={section.heading} className="guides-section">
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          <div className="guides-cta">
            <h2>Ready to take the next step?</h2>
            <p>
              Compare day and boarding schools, or talk things through with our team before you
              decide.
            </p>
            <div className="guides-cta__actions">
              <Link className="guides-cta__primary" href="/schools">
                Explore schools
              </Link>
              <CounsellingLink className="guides-cta__secondary">
                Free counselling
              </CounsellingLink>
            </div>
          </div>
        </article>

        <aside className="guides-related" aria-label="Related guides">
          <h2>Related guides</h2>
          <ul>
            {related.map((item) => (
              <li key={item.slug}>
                <Link href={`/guides/${item.slug}`}>
                  <span className="guides-chip">{item.category}</span>
                  <span className="guides-related__title">{item.title}</span>
                  <span className="guides-related__time">{item.readingMinutes} min read</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
