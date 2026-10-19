import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BedDouble,
  BookOpen,
  Bus,
  CheckCircle2,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Landmark,
  MessageSquare,
  MapPin,
  Monitor,
  Phone,
  ShieldCheck,
  Star,
  Trophy,
  Utensils,
  Users,
  Waves,
} from "lucide-react";
import type { SchoolDetail, ReviewListItem, SchoolRatingSummary } from "@/lib/api";
import { reviews } from "@/lib/api";
import { schoolProfilePathFromSlugs, schoolTypeLabel, toSeoSlug } from "@/lib/seo-slugs";
import { schoolJsonLd } from "@/lib/structured-data";
import SchoolPhotoGallery from "./SchoolPhotoGallery";
import SchoolVideoGallery from "./SchoolVideoGallery";
import SchoolProfileNavigation from "./SchoolProfileNavigation";
import SchoolFeeSummary from "./SchoolFeeSummary";
import SchoolEnquiryForm from "./SchoolEnquiryForm";
import SchoolCallbackForm from "./SchoolCallbackForm";
import SchoolProfileActions from "./SchoolProfileActions";
import SchoolReviews from "./SchoolReviews";

async function loadReviewData(schoolId: string): Promise<{
  reviews: ReviewListItem[];
  summary: SchoolRatingSummary | null;
}> {
  try {
    const [listPage, summary] = await Promise.all([
      reviews.forSchool(schoolId),
      reviews.summary(schoolId),
    ]);
    return { reviews: listPage.results, summary };
  } catch {
    return { reviews: [], summary: null };
  }
}

function genderLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "coed" || normalized === "co-ed") return "Co-Ed";
  if (normalized === "boys" || normalized === "boys only") return "Boys Only";
  if (normalized === "girls" || normalized === "girls only") return "Girls Only";
  return value || "Not provided";
}

function verificationLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "verified") return "Verified school";
  if (normalized.includes("pending")) return "Verification in progress";
  return "Not yet verified";
}

function facilityAppearance(name: string, category: string) {
  const value = `${name} ${category}`.toLowerCase();
  if (value.includes("librar") || value.includes("book")) return { Icon: BookOpen, tone: "library" };
  if (value.includes("lab")) return { Icon: FlaskConical, tone: "laboratory" };
  if (value.includes("smart class") || value.includes("technology") || value.includes("computer")) return { Icon: Monitor, tone: "technology" };
  if (value.includes("sport") || value.includes("playground")) return { Icon: Trophy, tone: "sports" };
  if (value.includes("swim") || value.includes("pool")) return { Icon: Waves, tone: "aquatic" };
  if (value.includes("hostel") || value.includes("boarding")) return { Icon: BedDouble, tone: "residential" };
  if (value.includes("dining") || value.includes("food") || value.includes("cafeteria")) return { Icon: Utensils, tone: "dining" };
  if (value.includes("medical") || value.includes("health") || value.includes("clinic")) return { Icon: HeartPulse, tone: "medical" };
  if (value.includes("transport") || value.includes("bus")) return { Icon: Bus, tone: "transport" };
  if (value.includes("security") || value.includes("safety")) return { Icon: ShieldCheck, tone: "security" };
  return { Icon: CheckCircle2, tone: "general" };
}

export function schoolProfilePath(school: SchoolDetail) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_detail.slug,
    stateSlug: school.state_detail.slug,
    citySlug: school.city_detail.slug,
    localitySlug: school.location_detail?.slug,
    schoolSlug: school.slug,
  });
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

export default async function SchoolProfile({ school }: { school: SchoolDetail }) {
  const schoolImage = school.school_logo_url || school.school_image_url;
  const reviewData = await loadReviewData(school.school_id);
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
      label: schoolTypeLabel(type.type_code, type.slug, type.type_name),
      icon: BedDouble,
    })),
    { label: genderLabel(school.gender), icon: Users },
    {
      label: school.established_year ? `Est. ${school.established_year}` : "Year unknown",
      icon: Star,
    },
  ];
  const countrySlug = toSeoSlug(school.country_detail.slug);
  const stateSlug = toSeoSlug(school.state_detail.slug);
  const citySlug = toSeoSlug(school.city_detail.slug);
  const localitySlug = school.location_detail ? toSeoSlug(school.location_detail.slug) : null;
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: school.country_detail.country_name, url: `/home/${countrySlug}` },
    { name: school.state_detail.state_name, url: `/${countrySlug}/${stateSlug}` },
    { name: school.city_detail.city_name, url: `/${countrySlug}/${stateSlug}/${citySlug}` },
    ...(school.location_detail
      ? [{ name: school.location_detail.location_name, url: `/${countrySlug}/${stateSlug}/${citySlug}/${localitySlug}` }]
      : []),
    { name: school.school_name, url: schoolProfilePath(school) },
  ];
  const aggregateRating =
    reviewData.summary && reviewData.summary.average_rating != null && reviewData.summary.review_count > 0
      ? {
          ratingValue: reviewData.summary.average_rating,
          reviewCount: reviewData.summary.review_count,
          bestRating: 5,
          worstRating: 1,
        }
      : null;
  const structuredData = JSON.stringify(schoolJsonLd(school, { breadcrumbs, aggregateRating })).replace(/</g, "\\u003c");

  return (
    <main className="school-detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <div className="school-detail">
        <Link className="school-detail__back" href="/schools"><ArrowLeft size={15} /> Back to schools</Link>

        <nav className="school-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>/</span>
          <Link href={`/${school.country_detail.slug}`}>{school.country_detail.country_name}</Link><span>/</span>
          <Link href={`/${school.country_detail.slug}/${school.state_detail.slug}`}>{school.state_detail.state_name}</Link><span>/</span>
          <Link href={`/${school.country_detail.slug}/${school.state_detail.slug}/${school.city_detail.slug}`}>{school.city_detail.city_name}</Link>
          {school.location_detail && <><span>/</span><span>{school.location_detail.location_name}</span></>}
          <span>/</span><span aria-current="page">{school.school_name}</span>
        </nav>

        <section className="school-detail__hero">
          {schoolImage ? (
            <Image
              className="school-detail__crest"
              src={schoolImage}
              alt={`${school.school_name} ${school.school_logo_url ? "logo" : "image"}`}
              width={80}
              height={80}
              unoptimized
            />
          ) : (
            <div className="school-detail__crest" aria-hidden="true">{(school.short_name || school.school_name).slice(0, 2).toUpperCase()}</div>
          )}
          <div className="school-detail__intro">
            <div className="school-detail__eyebrow">
              {school.is_featured && <span className="featured-badge">FEATURED</span>}
              {school.verification_status.toLowerCase() === "verified" && (
                <span className="verified-tag"><CheckCircle2 size={14} /> Verified school</span>
              )}
              {school.verification_status.toLowerCase() !== "verified" && <span>{verificationLabel(school.verification_status)}</span>}
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
            {school.phone && (
              <a
                className="detail-button detail-button--primary"
                href={`tel:${school.phone}`}
                aria-label={`Call ${school.school_name}`}
              >
                <Phone size={16} /> Call
              </a>
            )}
            <a className="detail-button" href="#school-enquiry"><MessageSquare size={16} /> Send an Enquiry</a>
            <SchoolProfileActions school={school} />
          </div>
        </section>

        <SchoolProfileNavigation />

        <div className="school-detail__grid">
          <section className="school-detail__main">
            {/* ===== SECTION 1: ABOUT ===== */}
            <article className="detail-panel" id="overview">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Landmark size={18} /></span>
                <div><h2>About this school</h2><p>Key information to help your family explore.</p></div>
              </div>
              <dl className="school-facts">
                <div><dt>Education board</dt><dd>{school.boards_detail.map((board) => board.board_name).join(", ") || "Not provided"}</dd></div>
                <div><dt>School type</dt><dd>{school.school_types_detail.map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name)).join(", ") || "Not provided"}</dd></div>
                <div><dt>Student community</dt><dd>{genderLabel(school.gender)}</dd></div>
                <div><dt>Established</dt><dd>{school.established_year ?? "Not provided"}</dd></div>
                <div><dt>Principal</dt><dd>{school.principal_name || "Not provided"}</dd></div>
              </dl>
            </article>

            {/* ===== SECTION 2: GRADES OFFERED (NEW) ===== */}
            <article className="detail-panel" id="admissions">
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
            <article className="detail-panel" id="facilities">
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
              <span id="infrastructure" className="school-detail__section-anchor" />

              {school.facilities_detail.length === 0 ? (
                <p className="empty-state"><Star size={16} /> Facilities info coming soon.</p>
              ) : (
                <div className="facility-groups">
                  {[...facilitiesByCategory.entries()].map(([category, list]) => (
                    <section key={category} className="facility-group">
                      <h3>{category}</h3>
                      <ul>
                        {list.map((f) => {
                          const { Icon, tone } = facilityAppearance(f.facility_name, f.category);
                          return (
                            <li key={f.school_facility_id} className={`facility facility--${tone}`}>
                              <span className="facility__name">
                                <span className="facility__icon"><Icon size={18} aria-hidden="true" /></span>
                                {f.facility_name}
                              </span>
                              {f.quantity_or_capacity != null && (
                                <span className="facility__qty">Qty {f.quantity_or_capacity}</span>
                              )}
                              {f.description && (
                                <p className="facility__desc">{f.description}</p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </article>

            {/* ===== SECTION 4: FEE SUMMARY (NEW) ===== */}
            <article className="detail-panel" id="fees">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Landmark size={18} /></span>
                <div>
                  <h2>Fee structure</h2>
                  <p>Published fee details are displayed once the school confirms them.</p>
                </div>
              </div>

              <SchoolFeeSummary
                schoolId={school.school_id}
                grades={school.grades_offered_detail.map(({ grade_id, grade_name }) => ({ grade_id, grade_name }))}
              />
            </article>

            <section className="detail-panel school-detail__media-panel" id="media">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><BookOpen size={18} /></span>
                <div><h2>Photos &amp; videos</h2><p>Explore the campus and school life.</p></div>
              </div>
              {(school.school_image_url || school.photos_detail?.length) ? (
                <SchoolPhotoGallery
                  photos={[
                    ...(school.school_image_url
                      ? [{
                          photo_id: "school-cover",
                          photo_url: school.school_image_url,
                          caption: "",
                          alt_text: `${school.school_name} campus`,
                          category: "CAMPUS",
                          sort_order: 0,
                        }]
                      : []),
                    ...(school.photos_detail ?? []).filter(
                      (photo) => photo.photo_url !== school.school_image_url,
                    ),
                  ]}
                  schoolName={school.school_name}
                />
              ) : (
                <p className="empty-state">School photos have not been published yet.</p>
              )}
              <SchoolVideoGallery videos={school.videos_detail ?? []} schoolName={school.school_name} />
            </section>

            <article className="detail-panel" id="reviews">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Star size={18} /></span>
                <div><h2>Reviews</h2><p>Parent experiences and school feedback.</p></div>
              </div>
              <SchoolReviews
                schoolId={school.school_id}
                schoolName={school.short_name || school.school_name}
                initialReviews={reviewData.reviews}
                initialSummary={reviewData.summary}
              />
            </article>

            {/* ===== SECTION 5: LOCATION / ADDRESS ===== */}
            <article className="detail-panel" id="location">
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
            <SchoolCallbackForm school={school} />
            <div id="school-enquiry"><SchoolEnquiryForm school={school} /></div>

            <p className="school-detail__disclaimer">BoardingEdu shares directory information for discovery. Please verify fees, admission requirements, and facilities with the school.</p>
          </aside>
        </div>
      </div>

      <div className="school-sticky-cta" role="group" aria-label="School contact actions">
        {school.phone ? (
          <a
            className="school-sticky-cta__call"
            href={`tel:${school.phone}`}
            aria-label={`Call ${school.school_name}`}
          >
            <Phone size={17} aria-hidden /> Call
          </a>
        ) : null}
        <a className="school-sticky-cta__enquire" href="#school-enquiry">
          <MessageSquare size={17} aria-hidden /> Enquire now
        </a>
      </div>
    </main>
  );
}
