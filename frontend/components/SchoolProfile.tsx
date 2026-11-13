import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Landmark,
  MessageSquare,
  MapPin,
  Phone,
  Star,
  Users,
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
import { buildProfileGalleryPhotos } from "@/lib/profile-media";
import { publicSchoolImageUrl, schoolCoverImageUrl } from "@/lib/school-media";
import { boardLabel, boardsAffiliatedLabel } from "@/lib/board-labels";
import { formatGradesRange } from "@/lib/grade-labels";
import SchoolProfileNavigation from "./SchoolProfileNavigation";
import RecentSchoolTracker from "./RecentSchoolTracker";
import SchoolFeesAndGrades from "./SchoolFeesAndGrades";
import SchoolFacilitiesInteractive from "./SchoolFacilitiesInteractive";
import SchoolEnquiryProvider from "./SchoolEnquiryDialog";
import SchoolProfileActions, { SchoolEnquiryButton } from "./SchoolProfileActions";
import SchoolReviews from "./SchoolReviews";
import SchoolTravelPanel from "./SchoolTravelPanel";
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

export function schoolProfilePath(school: SchoolDetail) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_detail.slug,
    stateSlug: school.state_detail.slug,
    citySlug: school.city_detail.slug,
    localitySlug: school.location_detail?.slug,
    schoolSlug: school.slug,
    schoolName: school.school_name,
    schoolTypes: school.school_types_detail,
  });
}

function listItemPath(school: SchoolListItem) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
    schoolName: school.school_name,
    schoolTypes: school.school_types_detail,
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

export default async function SchoolProfile({
  school,
  initialSection = "overview",
  initialEnquiryOpen = false,
}: {
  school: SchoolDetail;
  initialSection?: SchoolSectionId;
  initialEnquiryOpen?: boolean;
}) {
  const schoolImage = publicSchoolImageUrl(school.school_logo_url);
  const heroBackground = schoolCoverImageUrl(school);
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
  const latitude = Number(school.lat);
  const longitude = Number(school.lng);
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const mapFrameUrl = hasCoordinates
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=14&hl=en&output=embed`
    : null;
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

  // Quick-stats strip — only rendered for values that actually exist in the DB.
  const classesRange = formatGradesRange(school.grades_offered_detail);
  const quickStats = [
    {
      label: "Established",
      value: school.established_year ? String(school.established_year) : null,
      icon: CalendarDays,
    },
    { label: "Classes offered", value: classesRange, icon: GraduationCap },
    {
      label: "Education board",
      value: boardsAffiliatedLabel(school.boards_detail) || null,
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
  const galleryPhotos = buildProfileGalleryPhotos(school);

  return (
    <main className="school-detail-page school-detail-page--polished">
      <RecentSchoolTracker schoolId={school.school_id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqStructuredData }} />
      <SchoolEnquiryProvider school={school} initialOpen={initialEnquiryOpen}>
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

        <section
          className="school-detail__hero school-hero-card"
          style={{ backgroundImage: `url(${heroBackground || "/school-cover-fallback.svg"})` }}
        >
          <div className="school-hero-card__veil">
          <div className="school-detail__intro">
            {schoolImage ? (
              <Image
                className="school-detail__crest"
                src={schoolImage}
                alt={`${school.school_name} logo`}
                width={72}
                height={72}
                unoptimized
              />
            ) : (
              <div className="school-detail__crest" aria-hidden="true">{(school.short_name || school.school_name).slice(0, 2).toUpperCase()}</div>
            )}
            <div>
              <div className="school-detail__eyebrow">
                {school.is_featured && <span className="featured-badge">FEATURED</span>}
                {school.verification_status.toLowerCase() === "verified" && (
                  <span className="verified-tag"><CheckCircle2 size={14} /> Verified</span>
                )}
                {school.admission_open !== undefined && (
                  <span className={school.admission_open ? "school-admission-status is-open" : "school-admission-status"}>
                    {school.admission_open ? "Admissions open" : "Admissions closed"}
                  </span>
                )}
              </div>
              <h1>{school.school_name}</h1>
              <p className="school-detail__location"><MapPin size={16} />{location}</p>
              <div className="school-detail__hero-facts" aria-label="School highlights">
                {school.boards_detail.slice(0, 2).map((board) => (
                  <span className="school-chip" key={board.board_id}>{board.board_name}</span>
                ))}
                {school.school_types_detail.slice(0, 2).map((type) => (
                  <span className="school-chip" key={type.school_type_id}>
                    {schoolTypeLabel(type.type_code, type.slug, type.type_name)}
                  </span>
                ))}
                {school.gender && <span className="school-chip">{school.gender}</span>}
                {school.established_year && (
                  <span className="school-chip">Est. {school.established_year}</span>
                )}
              </div>
            </div>
            <div className="school-detail__actions">
              {school.phone && (
                <a className="detail-button detail-button--primary" href={`tel:${school.phone}`} aria-label={`Call ${school.school_name}`}>
                  <Phone size={16} /> Call
                </a>
              )}
              <SchoolEnquiryButton className="detail-button">
                <MessageSquare size={16} /> Send an Enquiry
              </SchoolEnquiryButton>
              <SchoolProfileActions school={school} />
            </div>
          </div>
          </div>
        </section>

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
                  school.boards_detail.length ? `, following ${boardsAffiliatedLabel(school.boards_detail)}` : ""
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
                        ? `, affiliated with ${boardsAffiliatedLabel(school.boards_detail)}`
                        : ""
                    }.`
                }
              />
              {school.principal_name && (
                <p className="school-detail__principal">Principal: {school.principal_name}</p>
              )}
            </article>

            <SchoolFeesAndGrades
              schoolId={school.school_id}
              grades={school.grades_offered_detail.map((g) => ({
                grade_id: g.grade_id,
                grade_name: g.grade_name,
                sort_order: g.sort_order,
              }))}
            />
            <Link
              className="school-fee-calculator-link"
              href={`/fee-calculator/?school=${encodeURIComponent(school.slug)}`}
            >
              Compare published fees for this school <ArrowRight size={15} aria-hidden />
            </Link>

            <article className="detail-panel" id="admissions">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><BookOpen size={18} /></span>
                <div>
                  <h2>Admission documents</h2>
                  <p>Brochures and documents shared by the school.</p>
                </div>
              </div>
              {school.admission_resources_detail.length === 0 ? (
                <p className="empty-state">The school has not shared a brochure or admission document list yet.</p>
              ) : (
                <div className="school-admission-resources">
                  {school.admission_resources_detail.some((item) => item.resource_type === "BROCHURE") && (
                    <section>
                      <h3>School brochures</h3>
                      <ul>
                        {school.admission_resources_detail
                          .filter((item) => item.resource_type === "BROCHURE")
                          .map((item) => (
                            <li key={item.resource_id}>
                              <div>
                                <strong>{item.title}</strong>
                                {item.description && <p>{item.description}</p>}
                              </div>
                              {item.document_url && (
                                <a href={item.document_url} target="_blank" rel="noopener noreferrer">Open brochure</a>
                              )}
                            </li>
                          ))}
                      </ul>
                    </section>
                  )}
                  {school.admission_resources_detail.some((item) => item.resource_type === "REQUIRED_DOCUMENT") && (
                    <section>
                      <h3>Required for admission</h3>
                      <ul>
                        {school.admission_resources_detail
                          .filter((item) => item.resource_type === "REQUIRED_DOCUMENT")
                          .map((item) => (
                            <li key={item.resource_id}>
                              <div>
                                <strong>{item.title}</strong>
                                {item.description && <p>{item.description}</p>}
                              </div>
                              {item.document_url && (
                                <a href={item.document_url} target="_blank" rel="noopener noreferrer">Open document</a>
                              )}
                            </li>
                          ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </article>

            {school.facilities_detail.length > 0 && (
            <article className="detail-panel" id="facilities">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Star size={18} /></span>
                <div>
                  <h2>Campus &amp; facilities</h2>
                  <p>Tap a facility to see details.</p>
                </div>
              </div>
              <span id="infrastructure" className="school-detail__section-anchor" />
              {school.facilities_detail.some((facility) => facility.quantity_or_capacity != null || facility.description) && (
                <dl className="infrastructure-facts">
                  {school.facilities_detail
                    .filter((facility) => facility.quantity_or_capacity != null || facility.description)
                    .map((facility) => (
                      <div key={facility.school_facility_id}>
                        <dt>{facility.facility_name}</dt>
                        <dd>
                          {facility.quantity_or_capacity != null ? `Capacity ${facility.quantity_or_capacity}` : ""}
                          {facility.quantity_or_capacity != null && facility.description ? " · " : ""}
                          {facility.description || ""}
                        </dd>
                      </div>
                    ))}
                </dl>
              )}
              <SchoolFacilitiesInteractive facilitiesByCategory={[...facilitiesByCategory.entries()]} />
            </article>
            )}

            <section className="detail-panel school-detail__media-panel" id="media">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><BookOpen size={18} /></span>
                <div>
                  <h2>Photos &amp; Videos</h2>
                  <p>Browse campus photos by category or open a video to learn more about {school.school_name}.</p>
                </div>
              </div>
              {galleryPhotos.length ? (
                <SchoolPhotoGallery
                  photos={galleryPhotos}
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
                <div>
                  <h2>Reviews</h2>
                  <p>Experiences shared by families.</p>
                </div>
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
                <SchoolTravelPanel
                  latitude={hasCoordinates ? latitude : null}
                  longitude={hasCoordinates ? longitude : null}
                  locationLabel={location}
                />
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
            <div className="detail-panel school-quick-panel" id="school-quick-info">
              <div className="detail-panel__heading">
                <span className="detail-panel__icon"><Star size={18} /></span>
                <div>
                  <h2>Quick info</h2>
                  <p>The details families check first.</p>
                </div>
              </div>
              {school.tagline && <p className="school-detail__tagline">{school.tagline}</p>}
              <dl className="school-quick-stats school-quick-stats--side">
                {quickStats.map(({ label, value, icon: Icon }) => (
                  <div className="school-quick-stat" key={label}>
                    <dt>
                      <span className="school-quick-stat__icon"><Icon size={16} aria-hidden="true" /></span>
                      {label}
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
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
                    {publicSchoolImageUrl(item.school_image_url) ? (
                      <Image
                        src={publicSchoolImageUrl(item.school_image_url)}
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
                          {boardLabel(board)}
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
