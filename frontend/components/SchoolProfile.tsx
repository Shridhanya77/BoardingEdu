import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BedDouble,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Star,
  Users,
} from "lucide-react";
import type { SchoolDetail } from "@/lib/api";
import SchoolEnquiryForm from "./SchoolEnquiryForm";

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

export function schoolProfilePath(school: SchoolDetail) {
  const residential = school.school_types_detail.some((type) =>
    /^(FULL-BOARDING|BOARDING)$/i.test(type.type_code) || /residential|boarding/i.test(type.type_name),
  );
  return `/${residential ? "residential-school" : "day-school"}/${school.country_detail.slug}/${school.state_detail.slug}/${school.city_detail.slug}/${school.slug}`;
}

function gradeBadge(gradeName: string, seats: number | null, entryAge: [number | null, number | null]) {
  const range = entryAge.filter((x): x is number => x != null);
  return (
    <li className="grade-offered" key={gradeName}>
      <div className="grade-offered__head">
        <span className="grade-offered__name">{gradeName}</span>
        {seats != null && (
          <span className={`grade-offered__seats ${seats === 0 ? "empty" : ""}`}>
            {seats === 0 ? "Closed" : `${seats} seats`}
          </span>
        )}
      </div>
      {range.length > 0 && (
        <p className="grade-offered__age">
          Entry age: {range.join(" – ")} year{range.length > 1 ? "s" : ""}
        </p>
      )}
    </li>
  );
}

export default function SchoolProfile({ school }: { school: SchoolDetail }) {
  const location = [
    school.location_detail?.location_name,
    school.city_detail.city_name,
    school.state_detail.state_name,
    school.country_detail.country_name,
  ].filter(Boolean).join(", ");

  // Group facilities by category for cleaner grid display
  const facilitiesByCategory = new Map<string, SchoolDetail["facilities_detail"][number][]>();
  for (const facility of school.facilities_detail ?? []) {
    const key = facility.category || "General";
    const list = facilitiesByCategory.get(key) ?? [];
    list.push(facility);
    facilitiesByCategory.set(key, list);
  }

  // Stats chips
  const chips = [
    ...school.boards_detail.map((board) => ({
      label: board.board_name,
      icon: Landmark,
    })),
    ...school.school_types_detail.map((type) => ({
      label: type.type_name,
      icon: BedDouble,
    })),
    { label: genderLabels[school.gender], icon: Users },
    {
      label: school.established_year ? `Est. ${school.established_year}` : "Year unknown",
      icon: Star,
    },
  ];

  return (
    <main className="school-detail-page">
      <div className="school-detail">
        <Link className="school-detail__back" href="/#schools"><ArrowLeft size={15} /> Back to schools</Link>

        <nav className="school-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>/</span>
          <span>{school.country_detail.country_name}</span><span>/</span>
          <span>{school.state_detail.state_name}</span><span>/</span>
          <span>{school.city_detail.city_name}</span>
        </nav>

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

            <div className="school-chips" role="list">
              {chips.map(({ label, icon: Icon }) => (
                <span key={label} className="school-chip" role="listitem">
                  <Icon size={14} aria-hidden /> {label}
                </span>
              ))}
            </div>
          </div>
          <div className="school-detail__actions">
            {school.phone && <a className="detail-button detail-button--primary" href={`tel:${school.phone}`}><Phone size={16} /> Call school</a>}
            {school.email && <a className="detail-button" href={`mailto:${school.email}`}><Mail size={16} /> Email school</a>}
          </div>
        </section>

        <div className="school-detail__grid">
          <section className="school-detail__main">
            {/* ===== SECTION 1: ABOUT ===== */}
            <article className="detail-panel">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Landmark size={18} /></span>
                <div><h2>About this school</h2><p>Key information to help your family explore.</p></div>
              </div>
              <dl className="school-facts">
                <div><dt>Education board</dt><dd>{school.boards_detail.map((board) => board.board_name).join(", ") || "Not provided"}</dd></div>
                <div><dt>School type</dt><dd>{school.school_types_detail.map((type) => type.type_name).join(", ") || "Not provided"}</dd></div>
                <div><dt>Student community</dt><dd>{genderLabels[school.gender]}</dd></div>
                <div><dt>Established</dt><dd>{school.established_year ?? "Not provided"}</dd></div>
                <div><dt>Principal</dt><dd>{school.principal_name || "Not provided"}</dd></div>
                <div><dt>School code</dt><dd>{school.school_code}</dd></div>
              </dl>
            </article>

            {/* ===== SECTION 2: GRADES OFFERED (NEW) ===== */}
            <article className="detail-panel">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><GraduationCap size={18} /></span>
                <div>
                  <h2>Grades offered</h2>
                  <p>
                    {school.grades_offered_detail.length
                      ? `${school.grades_offered_detail.length} grades are currently open for applications.`
                      : "Grade offerings are not published yet."}
                  </p>
                </div>
              </div>
              {school.grades_offered_detail.length === 0 ? (
                <p className="empty-state"><BookOpen size={16} /> Contact the school to confirm which grades they currently offer.</p>
              ) : (
                <ul className="grades-offered">
                  {school.grades_offered_detail.map((g) =>
                    gradeBadge(g.grade_name, g.seats_available, [g.entry_age_min, g.entry_age_max])
                  )}
                </ul>
              )}
            </article>

            {/* ===== SECTION 3: FACILITIES (NEW) ===== */}
            <article className="detail-panel">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Star size={18} /></span>
                <div>
                  <h2>Campus &amp; facilities</h2>
                  <p>
                    {school.facilities_detail.length
                      ? `${school.facilities_detail.length} available amenities at this school.`
                      : "Facilities have not yet been published for this school."}
                  </p>
                </div>
              </div>

              {school.facilities_detail.length === 0 ? (
                <p className="empty-state"><Star size={16} /> Facilities info coming soon.</p>
              ) : (
                <div className="facility-groups">
                  {[...facilitiesByCategory.entries()].map(([category, list]) => (
                    <section key={category} className="facility-group">
                      <h3>{category}</h3>
                      <ul>
                        {list.map((f) => (
                          <li key={f.school_facility_id} className="facility">
                            <span className="facility__name">
                              <CheckCircle2 size={14} aria-hidden /> {f.facility_name}
                            </span>
                            {f.quantity_or_capacity != null && (
                              <span className="facility__qty">Qty {f.quantity_or_capacity}</span>
                            )}
                            {f.description && (
                              <p className="facility__desc">{f.description}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </article>

            {/* ===== SECTION 4: FEE SUMMARY (NEW) ===== */}
            <article className="detail-panel">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Landmark size={18} /></span>
                <div>
                  <h2>Fee structure</h2>
                  <p>Published fee details are displayed once the school confirms them.</p>
                </div>
              </div>

              <div className="fee-summary">
                <p className="empty-state">
                  <CheckCircle2 size={16} />
                  Fee structures are being verified by the school.
                  Submit an enquiry on this page and they will share the latest fee schedule
                  along with available scholarships and sibling discounts.
                </p>
                <small className="fee-summary__note">
                  Tip: in a full production deployment this panel pulls published
                  <code> FeeStructure </code> rows from the BoardingEdu API and shows a
                  grade-by-grade breakdown with tuition, accommodation, and transport.
                </small>
              </div>
            </article>

            {/* ===== SECTION 5: LOCATION / ADDRESS ===== */}
            <article className="detail-panel">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><MapPin size={18} /></span>
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

          {/* ===== ASIDE ===== */}
          <aside className="school-detail__aside">
            <section className="detail-panel contact-panel">
              <div className="section-eyebrow">TAKE THE NEXT STEP</div>
              <h2>Talk to the school</h2>
              <p>School information may change. Reach out directly to confirm current details, availability, and admissions.</p>
              {school.phone && <a className="detail-button detail-button--primary" href={`tel:${school.phone}`}><Phone size={16} /> {school.phone}</a>}
              {school.email && <a className="detail-button" href={`mailto:${school.email}`}><Mail size={16} /> Send an email</a>}
              <div className="contact-panel__status"><CheckCircle2 size={15} />{verificationLabels[school.verification_status]}</div>
            </section>

            {/* ===== ENQUIRY FORM ===== */}
            <SchoolEnquiryForm school={school} />

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
