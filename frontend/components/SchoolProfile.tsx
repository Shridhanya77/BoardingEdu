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
  Plane,
  ShieldCheck,
  Star,
  Train,
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
  homeSchoolCategory,
  schoolProfilePathFromSlugs,
  schoolProfileTypeSegment,
  schoolTypeLabel,
  toSeoSlug,
} from "@/lib/seo-slugs";
import { boardListingPath, placeListingPath } from "@/lib/school-urls";
import { schoolProfileFaqs } from "@/lib/school-faqs";
import { faqJsonLd, schoolJsonLd } from "@/lib/structured-data";
import SchoolFaqList from "./SchoolFaqList";
import FeaturedSchoolCards from "./home/FeaturedSchoolCards";
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
  const nearbyFeaturedSchools = nearbySchools?.items
    .filter((item) => item.is_featured)
    .slice(0, 4) ?? [];
  const location = [
    school.location_detail?.location_name,
    school.city_detail.city_name,
    school.state_detail.state_name,
    school.country_detail.country_name,
  ].filter(Boolean).join(", ");
  const latitude = school.lat ?? Number.NaN;
  const longitude = school.lng ?? Number.NaN;
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const mapFrameUrl = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : null;
  const travelOptions = [
    { label: "Railway station", query: "railway station", Icon: Train },
    { label: "Airport", query: "airport", Icon: Plane },
    { label: "Metro station", query: "metro station", Icon: Train },
    { label: "Major landmark", query: "landmark", Icon: Landmark },
  ].map((option) => ({
    ...option,
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${option.query} near ${hasCoordinates ? `${latitude},${longitude}` : location}`,
    )}`,
  }));
  const cityName = school.city_detail.city_name;
  const stateName = school.state_detail.state_name;
  const primaryBoard = school.boards_detail[0];
  const primaryType = school.school_types_detail[0];
  const homeCategory = primaryType
    ? homeSchoolCategory(primaryType.type_code, primaryType.slug, primaryType.type_name)
    : null;
  const categoryLabel = homeCategory === "day-school" ? "Day Schools" : homeCategory ? "Boarding Schools" : "Schools";
  const cityPlace = {
    countrySlug: school.country_detail.slug,
    stateSlug: school.state_detail.slug,
    citySlug: school.city_detail.slug,
  };
  const relatedSearchLinks: { label: string; href: string }[] = [
    ...(primaryBoard
      ? [{
          label: `${primaryBoard.board_name} ${categoryLabel}`,
          href: boardListingPath(primaryBoard.slug, homeCategory),
        }]
      : []),
    ...(homeCategory
      ? [{
          label: `${categoryLabel} in ${cityName}`,
          href: placeListingPath({ ...cityPlace, category: homeCategory }),
        }]
      : []),
    { label: `More schools in ${cityName}`, href: placeListingPath(cityPlace) },
    {
      label: `Schools in ${stateName}`,
      href: placeListingPath({
        countrySlug: school.country_detail.slug,
        stateSlug: school.state_detail.slug,
      }),
    },
    ...(school.location_detail
      ? [{
          label: `Schools in ${school.location_detail.location_name}`,
          href: placeListingPath({
            ...cityPlace,
            locationSlug: school.location_detail.slug,
          }),
        }]
      : []),
  ];
  const profileFaqs = schoolProfileFaqs(school);

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
  const faqStructuredData = JSON.stringify(faqJsonLd(profileFaqs)).replace(/</g, "\\u003c");

  return (
    <main className="school-detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqStructuredData }} />
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

        <SchoolProfileNavigation
          schoolPath={schoolProfilePath(school)}
          schoolName={school.school_name}
          city={cityName}
          overviewDescription={(
            (school.tagline || school.about?.replace(/\s+/g, " ").trim())
              ? `${school.school_name} is a ${
                  school.school_types_detail.length
                    ? school.school_types_detail.map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name).toLowerCase()).join(" and ")
                    : "school"
                } in ${cityName}, ${stateName}. ${school.tagline || school.about?.replace(/\s+/g, " ").trim()}`
              : `Explore ${school.school_name}, a ${
                  school.school_types_detail.length
                    ? school.school_types_detail.map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name).toLowerCase()).join(" and ")
                    : "school"
                } in ${cityName}, ${stateName}${
                  school.boards_detail.length ? `, following ${school.boards_detail.map((board) => board.board_name).join(" and ")}` : ""
                }. View fees, facilities and admissions information.`
          ).slice(0, 180)}
          initialSection={initialSection}
        />

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
              <section className="school-travel" aria-labelledby="school-travel-heading">
                <div className="school-travel__heading">
                  <span className="school-location-card__eyebrow">PLAN YOUR VISIT</span>
                  <h3 id="school-travel-heading">Travel &amp; accessibility</h3>
                  <p>Find nearby transport and landmarks. Confirm routes and travel times before visiting.</p>
                </div>
                <div className="school-travel__grid">
                  {travelOptions.map(({ label, href, Icon }) => (
                    <a
                      className="school-travel__card"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      key={label}
                    >
                      <span className="school-travel__icon"><Icon size={20} aria-hidden /></span>
                      <span className="school-travel__label">{label}</span>
                      <strong>Explore nearby</strong>
                      <span className="school-travel__distance">
                        {hasCoordinates ? "Open nearby places in Maps" : "Search by school location"}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
              <div className="school-location-card">
                <div className="school-location-card__details">
                  <span className="school-location-card__eyebrow">SCHOOL ADDRESS</span>
                  <address className="school-address">
                    {school.address || "The school has not published a street address."}
                    {school.pincode && <span>PIN code: {school.pincode}</span>}
                    <span>{location}</span>
                  </address>
                  {hasCoordinates && (
                    <a
                      className="map-link"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps <ArrowRight size={15} aria-hidden />
                    </a>
                  )}
                </div>
                {mapFrameUrl ? (
                  <iframe
                    className="school-location-card__map"
                    src={mapFrameUrl}
                    title={`Map showing ${school.school_name}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="school-location-card__unavailable">
                    <MapPin size={22} aria-hidden />
                    <span>Map preview unavailable</span>
                    <small>Accurate coordinates have not been provided.</small>
                  </div>
                )}
              </div>
            </article>
          </section>

          {/* ===== ASIDE ===== */}
          <aside className="school-detail__aside">
            <div className="detail-panel enquiry-panel" id="school-enquiry">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><MessageSquare size={18} /></span>
                <div>
                  <h2>Send a school enquiry</h2>
                  <p>Ask the school about fees, availability, facilities, or visits.</p>
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
          <>
          {nearbyFeaturedSchools.length > 0 && (
            <section className="school-profile-featured" aria-labelledby="school-profile-featured-heading">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Star size={18} /></span>
                <div>
                  <h2 id="school-profile-featured-heading">Featured schools nearby</h2>
                  <p>Explore featured schools around {cityName}.</p>
                </div>
              </div>
              <FeaturedSchoolCards schools={nearbyFeaturedSchools} />
            </section>
          )}
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
          </>
        )}
        {relatedSearchLinks.length > 0 && (
          <nav className="school-profile-related" aria-labelledby="school-profile-related-heading">
            <h2 id="school-profile-related-heading">Related school searches</h2>
            <div>
              {relatedSearchLinks.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </nav>
        )}
        <SchoolFaqList schoolName={school.school_name} city={cityName} items={profileFaqs} />
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
