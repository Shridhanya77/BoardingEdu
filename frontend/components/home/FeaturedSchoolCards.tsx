"use client";

import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { schools as schoolApi, type SchoolListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs, schoolTypeLabel } from "@/lib/seo-slugs";
import { schoolEnquiryPath } from "@/lib/school-urls";
import { publicSchoolImageUrl, schoolCoverImageUrl } from "@/lib/school-media";
import { boardsAffiliatedLabel } from "@/lib/board-labels";

function schoolHref(school: SchoolListItem) {
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

function schoolEnquiryHref(school: SchoolListItem) {
  return schoolEnquiryPath(school);
}

function formatFee(value: string | null) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L / yr`;
  }
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)} / yr`;
}

function FeaturedSchoolCover({ school }: { school: SchoolListItem }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const initials = (school.short_name || school.school_name).slice(0, 2);
  const photo = schoolCoverImageUrl(school);

  return (
    <div className="featured-card__cover">
      {school.is_featured && <span className="featured-card__tag">Featured</span>}
      {photo && !photoFailed ? (
        <span className="featured-card__photo-frame">
          <Image
            className="featured-card__photo"
            src={photo}
            alt={`${school.school_name} campus`}
            fill
            sizes="(max-width: 720px) 100vw, 280px"
            unoptimized
            onError={() => setPhotoFailed(true)}
          />
        </span>
      ) : null}
      <div className="featured-card__logo">
        {school.school_logo_url && !logoFailed ? (
          <Image
            src={publicSchoolImageUrl(school.school_logo_url)}
            alt=""
            width={56}
            height={56}
            unoptimized
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span aria-label={`${school.school_name} logo unavailable`}>{initials}</span>
        )}
      </div>
    </div>
  );
}

function FeaturedSchoolPreview({ school }: { school: SchoolListItem }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = schoolCoverImageUrl(school);
  const location = [school.city_name, school.state_name].filter(Boolean).join(", ");
  const types = Array.from(new Set(
    school.school_types_detail
      .map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name))
      .filter(Boolean),
  ));

  return (
    <div className="featured-hover-preview" aria-hidden="true">
      <article className="featured-hover-preview__card">
        <div className="featured-hover-preview__cover">
          {photo && !photoFailed ? (
            <Image
              src={photo}
              alt=""
              fill
              sizes="(max-width: 720px) 100vw, 520px"
              unoptimized
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <span>{(school.short_name || school.school_name).slice(0, 2)}</span>
          )}
          <span className="featured-hover-preview__eyebrow">Featured school</span>
        </div>
        <div className="featured-hover-preview__body">
          <h2>{school.school_name}</h2>
          <p><MapPin size={15} /> {location || "Location not listed"}</p>
          {types.length > 0 && (
            <div className="featured-hover-preview__types">
              {types.map((type) => <span key={type}>{type}</span>)}
            </div>
          )}
          <span className="featured-hover-preview__cta">
            Explore school <ArrowRight size={16} />
          </span>
        </div>
      </article>
    </div>
  );
}

export default function FeaturedSchoolCards({
  schools,
  keyPrefix = "",
}: {
  schools: SchoolListItem[];
  keyPrefix?: string;
}) {
  const [previewSchool, setPreviewSchool] = useState<SchoolListItem | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  return (
    <>
      <div className="featured-cards">
        {schools.map((school) => {
          const boards = boardsAffiliatedLabel(school.boards_detail) || "Board on request";
          const fee = formatFee(school.annual_fee);
          const location = [school.city_name, school.state_name].filter(Boolean).join(", ");
          const types = Array.from(new Set(
            school.school_types_detail
              .map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name))
              .filter(Boolean),
          ));

          return (
            <article
              className="featured-card featured-card--compact"
              key={`${keyPrefix}${school.school_id}`}
              onMouseEnter={() => setPreviewSchool(school)}
              onMouseLeave={() => setPreviewSchool(null)}
              onFocus={() => setPreviewSchool(school)}
              onBlur={(event) => {
                const nextTarget = event.relatedTarget;
                if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                  setPreviewSchool(null);
                }
              }}
            >
              <Link
                className="featured-card__details"
                href={schoolHref(school)}
                onClick={() => {
                  schoolApi.trackEngagement(school.school_id, "LISTING_CLICK").catch((reason: unknown) => {
                    console.error("Could not record this school listing click.", reason);
                  });
                }}
              >
                <FeaturedSchoolCover school={school} />
                <h3>{school.school_name}</h3>
                <p className="featured-card__types" aria-label={`School type: ${types.join(", ")}`}>
                  {types.map((type) => <span key={type}>{type}</span>)}
                </p>
                <p className="featured-card__place">
                  <MapPin size={13} />
                  {location || "Location not listed"}
                </p>
                <p className="featured-card__meta">{[boards, fee].filter(Boolean).join(" · ")}</p>
                <span className="featured-card__rating">
                  {school.verification_status?.toLowerCase() === "verified" && (
                    <><CheckCircle2 size={12} /> Verified</>
                  )}
                </span>
              </Link>
              <div className="featured-card__actions">
                <Link
                  className="featured-card__cta"
                  href={schoolHref(school)}
                  onClick={() => {
                    schoolApi.trackEngagement(school.school_id, "LISTING_CLICK").catch((reason: unknown) => {
                      console.error("Could not record this school listing click.", reason);
                    });
                  }}
                >
                  View school <ArrowRight size={14} aria-hidden />
                </Link>
                <Link className="featured-card__enquiry" href={schoolEnquiryHref(school)}>
                  Enquire
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {portalReady && previewSchool && createPortal(
        <FeaturedSchoolPreview school={previewSchool} />,
        document.body,
      )}
    </>
  );
}
