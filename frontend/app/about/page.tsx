import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, GraduationCap, SearchCheck } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About BoardingEdu | Find the Right School",
  description:
    "Learn how BoardingEdu helps families discover and compare day schools and boarding schools across India.",
  path: "/about",
});

const steps = [
  {
    icon: SearchCheck,
    title: "Explore schools",
    description:
      "Browse school listings by location, school type, and education board.",
  },
  {
    icon: Compass,
    title: "Compare your options",
    description:
      "Use school profiles and directory details to shortlist options that fit your family's search.",
  },
  {
    icon: GraduationCap,
    title: "Take the next step",
    description:
      "Review published admission information or ask our team to call you for guidance.",
  },
];

export default function AboutPage() {
  return (
    <main className="info-page about-page">
      <nav className="school-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span aria-current="page">About Us</span>
      </nav>
      <section className="info-page__hero">
        <span className="info-page__eyebrow">ABOUT BOARDINGEDU</span>
        <h1>Make your school search clearer.</h1>
        <p>
          Finding a school is a big decision. BoardingEdu brings school
          discovery into one place, so families can explore day schools and
          boarding schools by the details that matter to them.
        </p>
        <Link className="info-page__primary-link" href="/india/">
          Explore schools <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <section className="info-page__content" aria-labelledby="about-purpose">
        <div className="info-page__section-heading">
          <span className="info-page__eyebrow">OUR PURPOSE</span>
          <h2 id="about-purpose">A helpful starting point for every family</h2>
          <p>
            We organize published school directory information into useful
            profiles and search pages. Families can explore locations, school
            types, boards, and admission details, then decide which schools to
            learn more about.
          </p>
        </div>
        <div className="info-page__steps">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <article className="info-page__step" key={title}>
              <span className="info-page__step-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="info-page__step-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="info-page__cta">
        <div>
          <span className="info-page__eyebrow">NEED A HAND?</span>
          <h2>Our team can help you take the next step.</h2>
          <p>Get in touch with us for school search help and admission guidance.</p>
        </div>
        <Link className="info-page__secondary-link" href="/contact/">
          Contact BoardingEdu <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
