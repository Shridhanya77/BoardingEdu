import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  BookOpen,
  Bus,
  CalendarDays,
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
import type {
  SchoolDetail,
  SchoolFilters,
  SchoolListItem,
  ReviewListItem,
  SchoolRatingSummary,
} from "@/lib/api";
import { reviews, schools } from "@/lib/api";
import {
  schoolProfilePathFromSlugs,
  schoolProfileTypeSegment,
  schoolTypeLabel,
  toSeoSlug,
} from "@/lib/seo-slugs";
import { schoolJsonLd } from "@/lib/structured-data";
import SchoolPhotoGallery from "./SchoolPhotoGallery";
import SchoolVideoGallery from "./SchoolVideoGallery";
import SchoolProfileNavigation from "./SchoolProfileNavigation";
import SchoolFeeSummary from "./SchoolFeeSummary";
import SchoolEnquiryProvider from "./SchoolEnquiryDialog";
import SchoolProfileActions, { SchoolEnquiryButton } from "./SchoolProfileActions";
import SchoolReviews from "./SchoolReviews";
import ReadMore from "./ReadMore";
import type { SchoolSectionId } from "@/lib/school-sections";

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
    typeSegment: schoolProfileTypeSegment(school.school_types_detail),
  });
}

function listItemPath(school: SchoolListItem) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
    typeSegment: schoolProfileTypeSegment(school.school_types_detail),
  });
}

function formatFee(value: string | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

/**
 * Other schools to compare with this one. We widen the search step by step —
 * city, then state, then board — so a visitor always sees a useful next step
 * instead of an empty block.
 */
async function loadNearbySchools(
  school: SchoolDetail,
): Promise<{ label: string; items: SchoolListItem[] } | null> {
  const board = school.boards_detail[0];
  const tiers: { label: string; filters: SchoolFilters }[] = [
    {
      label: `Other schools in ${school.city_detail.city_name}`,
      filters: { city: school.city_detail.city_id },
    },
    {
      label: `Other schools in ${school.state_detail.state_name}`,
      filters: { state: school.state_detail.state_id },
    },
    ...(board
      ? [
          {
            label: `Other ${board.board_name} schools`,
            filters: { board: board.board_id },
          },
        ]
      : []),
  ];

  for (const tier of tiers) {
    try {
      const page = await schools.list({
        ...tier.filters,
        ordering: "-is_featured",
        page_size: 7,
      });
      const items = page.results
        .filter((item) => item.school_id !== school.school_id)
        .slice(0, 6);
      if (items.length) return { label: tier.label, items };
    } catch {
      // A failed tier should never break the profile page — widen instead.
    }
  }

  return null;
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
          Entry age {range.join("–")}
        </p>
      )}
    </li>
  );
}

export default async function SchoolProfile({
  school,
  initialSection = "overview",
}: {
  school: SchoolDetail;
  initialSection?: SchoolSectionId;
}) {
  const schoolImage = school.school_logo_url || school.school_image_url;
  const heroBackground = school.school_image_url || school.school_logo_url;
  const [reviewData, nearbySchools] = await Promise.all([
    loadReviewData(school.school_id),
    loadNearbySchools(school),
  ]);
  const location = [
    school.location_detail?.location_name,
    school.city_detail.city_name,
    school.state_detail.state_name,
    school.country_detail.country_name,
  ].filter(Boolean).join(", ");
  const cityName = school.city_detail.city_name;
  const stateName = school.state_detail.state_name;
  const cityFilters = { city: school.city_detail.city_id };
  const stateFilters = { state: school.state_detail.state_id };
  const primaryBoard = school.boards_detail[0];
  const primaryType = school.school_types_detail[0];
  const relatedSearchLinks: { label: string; filters: Record<string, string> }[] = [
    ...(primaryBoard
      ? [{
          label: `${primaryBoard.board_name} schools in ${cityName}`,
          filters: { board: primaryBoard.board_id, ...cityFilters },
        }]
      : []),
    ...(primaryType
      ? [{
          label: `${schoolTypeLabel(primaryType.type_code, primaryType.slug, primaryType.type_name)} schools in ${cityName}`,
          filters: { school_type: primaryType.school_type_id, ...cityFilters },
        }]
      : []),
    { label: `More schools in ${cityName}`, filters: cityFilters },
    { label: `Schools in ${stateName}`, filters: stateFilters },
  ];

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
  // Quick-stats strip — only rendered for values that actually exist in the DB.
  const orderedGrades = [...school.grades_offered_detail].sort(
    (left, right) => left.sort_order - right.sort_order,
  );
  const classesRange = orderedGrades.length
    ? orderedGrades[0].grade_name === orderedGrades[orderedGrades.length - 1].grade_name
      ? orderedGrades[0].grade_name
      : `${orderedGrades[0].grade_name} – ${orderedGrades[orderedGrades.length - 1].grade_name}`
    : null;
  const quickStats = [
    {
      label: "Established",
      value: school.established_year ? String(school.established_year) : null,
      icon: CalendarDays,
    },
    { label: "Classes offered", value: classesRange, icon: GraduationCap },
    {
      label: "Education board",
      value: school.boards_detail.map((board) => board.board_name).join(", ") || null,
      icon: Landmark,
    },
    { label: "Student community", value: genderLabel(school.gender), icon: Users },
    {
      label: "Facilities listed",
      value: school.facilities_detail.length
        ? String(school.facilities_detail.length)
        : null,
      icon: Star,
    },
  ].filter((stat): stat is { label: string; value: string; icon: typeof Star } =>
    Boolean(stat.value),
  );

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
      <SchoolEnquiryProvider school={school}>
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

        <section className={`school-detail__hero${heroBackground ? " school-detail__hero--image" : ""}`}>
          {heroBackground && (
            <span className="school-detail__hero-bg" aria-hidden="true">
              <Image src={heroBackground} alt="" fill sizes="100vw" unoptimized priority />
            </span>
          )}
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
              {school.admission_open !== undefined && (
                <span className={school.admission_open ? "school-admission-status is-open" : "school-admission-status"}>
                  {school.admission_open ? "Admissions open" : "Admissions closed"}
                </span>
              )}
              {school.established_year && <span>Established {school.established_year}</span>}
            </div>
            <h1>{school.school_name}</h1>
            {school.short_name && <p className="school-detail__short-name">{school.short_name}</p>}
            {school.tagline && <p className="school-detail__tagline">{school.tagline}</p>}
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
            <SchoolEnquiryButton className="detail-button">
              <MessageSquare size={16} /> Send an Enquiry
            </SchoolEnquiryButton>
            <SchoolProfileActions school={school} />
          </div>
        </section>

        {quickStats.length > 0 && (
          <dl className="school-quick-stats" aria-label="School quick facts">
            {quickStats.map(({ label, value, icon: Icon }) => (
              <div className="school-quick-stat" key={label}>
                <dt>
                  <span className="school-quick-stat__icon">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <SchoolProfileNavigation schoolPath={schoolProfilePath(school)} initialSection={initialSection} />

        <div className="school-detail__grid">
          <section className="school-detail__main">
            {/* ===== SECTION 1: ABOUT ===== */}
            <article className="detail-panel" id="overview">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Landmark size={18} /></span>
                <div><h2>Overview</h2></div>
              </div>
              <ReadMore
                text={
                  school.about?.trim()
                    || `${school.school_name} is a ${
                      school.school_types_detail.length
                        ? school.school_types_detail.map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name).toLowerCase()).join(" and ")
                        : "school"
                    } in ${location}${
                      school.boards_detail.length
                        ? `, affiliated with ${school.boards_detail.map((board) => board.board_name).join(" and ")}`
                        : ""
                    }.`
                }
              />
              {school.principal_name && (
                <p className="school-detail__principal">Principal: {school.principal_name}</p>
              )}
            </article>

            <article className="detail-panel" id="fees">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Landmark size={18} /></span>
                <div><h2>Fees</h2></div>
              </div>
              <SchoolFeeSummary
                schoolId={school.school_id}
                grades={school.grades_offered_detail.map(({ grade_id, grade_name }) => ({ grade_id, grade_name }))}
              />
            </article>

            <article className="detail-panel" id="admissions">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><GraduationCap size={18} /></span>
                <div>
                  <h2>Grades</h2>
                </div>
              </div>
              {school.grades_offered_detail.length === 0 ? (
                <p className="empty-state"><BookOpen size={16} /> Contact the school to confirm which grades they currently offer.</p>
              ) : (
                <ul className="grades-offered grades-offered--ribbon">
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
                  {school.facilities_detail.length === 0 && (
                    <p>Facilities have not yet been published for this school.</p>
                  )}
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
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
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
            <div className="detail-panel enquiry-panel" id="school-enquiry">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><MessageSquare size={18} /></span>
                <div>
                  <h2>Enquire about admissions</h2>
                  <p>Share a few details and the school will get back to you.</p>
                </div>
              </div>
              <SchoolEnquiryButton className="primary-button">
                <MessageSquare size={16} /> Send an enquiry
              </SchoolEnquiryButton>
            </div>

            <p className="school-detail__disclaimer">BoardingEdu shares directory information for discovery. Please verify fees, admission requirements, and facilities with the school.</p>
          </aside>
        </div>

        {nearbySchools && (
          <section className="school-nearby" aria-labelledby="school-nearby-heading">
            <div className="detail-panel__heading">
              <span className="detail-panel__icon"><GraduationCap size={18} /></span>
              <div>
                <h2 id="school-nearby-heading">{nearbySchools.label}</h2>
                <p>Other schools families shortlist alongside {school.short_name || school.school_name}.</p>
              </div>
            </div>

            <div className="school-nearby__grid">
              {nearbySchools.items.map((item) => (
                <Link
                  className="school-nearby-card"
                  href={listItemPath(item)}
                  key={item.school_id}
                >
                  <span className="school-nearby-card__media">
                    {item.school_image_url ? (
                      <Image
                        src={item.school_image_url}
                        alt={`${item.school_name} campus`}
                        fill
                        sizes="220px"
                        unoptimized
                      />
                    ) : (
                      <GraduationCap size={22} aria-hidden="true" />
                    )}
                  </span>

                  <span className="school-nearby-card__body">
                    <strong className="school-nearby-card__name">{item.school_name}</strong>

                    <span className="school-nearby-card__place">
                      <MapPin size={13} aria-hidden="true" />
                      {[item.city_name, item.state_name].filter(Boolean).join(", ")}
                    </span>

                    <span className="school-nearby-card__tags">
                      {item.boards_detail.slice(0, 2).map((board) => (
                        <span className="school-tag school-tag--blue" key={board.board_id}>
                          {board.board_name}
                        </span>
                      ))}
                      {formatFee(item.annual_fee) && (
                        <span className="school-tag school-tag--fee">
                          From {formatFee(item.annual_fee)} / year
                        </span>
                      )}
                    </span>
                  </span>

                  <ArrowRight className="school-nearby-card__arrow" size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}
        {relatedSearchLinks.length > 0 && (
          <nav className="school-profile-related" aria-labelledby="school-profile-related-heading">
            <h2 id="school-profile-related-heading">Related school searches</h2>
            <div>
              {relatedSearchLinks.map((item) => (
                <Link
                  key={item.label}
                  href={`/schools?${new URLSearchParams(item.filters).toString()}`}
                >
                  {item.label} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </nav>
        )}
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
        <SchoolEnquiryButton className="school-sticky-cta__enquire">
          <MessageSquare size={17} aria-hidden /> Enquire now
        </SchoolEnquiryButton>
      </div>
      </SchoolEnquiryProvider>
    </main>
  );
}
