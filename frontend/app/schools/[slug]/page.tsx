import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BedDouble, CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { ApiError, schools } from "@/lib/api";
import type { SchoolDetail } from "@/lib/api";

export const metadata: Metadata = {
  title: "School profile | BoardingEdu",
};

const genderLabels = {
  COED: "Co-Ed",
  BOYS: "Boys Only",
  GIRLS: "Girls Only",
} as const;

const verificationLabels = {
  UNVERIFIED: "Not yet verified",
  PENDING: "Verification in progress",
  VERIFIED: "Verified school",
} as const;

export default async function SchoolPage({ params }: { params: { slug: string } }) {
  let school: SchoolDetail;
  try {
    school = await schools.bySlug(params.slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const location = [
    school.location_detail?.location_name,
    school.city_detail.city_name,
    school.state_detail.state_name,
    school.country_detail.country_name,
  ].filter(Boolean).join(", ");

  return (
    <main className="school-detail-page">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="BoardingEdu home">
          <Image
            className="brand__image"
            src="/BoardingEdu_LOGO.jpeg"
            alt="BoardingEdu"
            width={1024}
            height={1024}
            priority
          />
        </Link>
        <Link className="header-action" href="/#schools">Find a school <ArrowRight size={15} /></Link>
      </header>

      <div className="school-detail">
        <Link className="school-detail__back" href="/#schools"><ArrowLeft size={15} /> Back to schools</Link>

        <section className="school-detail__hero">
          <div className="school-detail__crest" aria-hidden="true">{(school.short_name || school.school_name).slice(0, 2).toUpperCase()}</div>
          <div className="school-detail__intro">
            <div className="school-detail__eyebrow">
              {school.verification_status === "VERIFIED" && (
                <span className="verified-tag"><CheckCircle2 size={14} /> Verified school</span>
              )}
              {school.established_year && <span>Established {school.established_year}</span>}
            </div>
            <h1>{school.school_name}</h1>
            {school.short_name && <p className="school-detail__short-name">{school.short_name}</p>}
            <p className="school-detail__location"><MapPin size={16} />{location}</p>
          </div>
          <div className="school-detail__actions">
            {school.phone && <a className="detail-button detail-button--primary" href={`tel:${school.phone}`}><Phone size={16} /> Call school</a>}
            {school.email && <a className="detail-button" href={`mailto:${school.email}`}><Mail size={16} /> Email school</a>}
          </div>
        </section>

        <div className="school-detail__grid">
          <section className="school-detail__main">
            <article className="detail-panel">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><MapPin size={18} /></span>
                <div><h2>About this school</h2><p>Key information to help your family explore.</p></div>
              </div>
              <dl className="school-facts">
                <div><dt>Education board</dt><dd>{school.board_detail.board_name}</dd></div>
                <div><dt>School type</dt><dd>{school.school_type_detail.type_name}</dd></div>
                <div><dt>Student community</dt><dd>{genderLabels[school.gender]}</dd></div>
                <div><dt>Established</dt><dd>{school.established_year ?? "Not provided"}</dd></div>
                <div><dt>Principal</dt><dd>{school.principal_name || "Not provided"}</dd></div>
              </dl>
            </article>

            <article className="detail-panel">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><BedDouble size={18} /></span>
                <div><h2>Location &amp; address</h2><p>Contact the school to confirm visiting details.</p></div>
              </div>
              <address className="school-address">
                {school.address}
                {school.pincode && <span>{school.pincode}</span>}
                <span>{location}</span>
              </address>
              {school.lat && school.lng && (
                <a
                  className="map-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${school.lat},${school.lng}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open location in Maps
                </a>
              )}
            </article>
          </section>

          <aside className="school-detail__aside">
            <section className="detail-panel contact-panel">
              <div className="section-eyebrow">TAKE THE NEXT STEP</div>
              <h2>Talk to the school</h2>
              <p>School information may change. Reach out directly to confirm current details, availability, and admissions.</p>
              {school.phone && <a className="detail-button detail-button--primary" href={`tel:${school.phone}`}><Phone size={16} /> {school.phone}</a>}
              {school.email && <a className="detail-button" href={`mailto:${school.email}`}><Mail size={16} /> Send an email</a>}
              <div className="contact-panel__status"><CheckCircle2 size={15} />{verificationLabels[school.verification_status]}</div>
            </section>
            <p className="school-detail__disclaimer">BoardingEdu shares directory information for discovery. Please verify fees, admission requirements, and facilities with the school.</p>
          </aside>
        </div>
      </div>

      <footer className="site-footer">
        <Link className="brand brand--footer" href="/" aria-label="BoardingEdu home">
          <Image className="brand__image" src="/BoardingEdu_LOGO.jpeg" alt="BoardingEdu" width={1024} height={1024} />
        </Link>
        <p>Helping every family find a place to belong.</p>
      </footer>
    </main>
  );
}
