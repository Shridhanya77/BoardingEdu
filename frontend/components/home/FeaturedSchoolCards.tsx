"use client";

import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { SchoolListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";
import { schoolEnquiryPath } from "@/lib/school-urls";

function schoolHref(school: SchoolListItem) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
  });
}

function schoolEnquiryHref(school: SchoolListItem) {
  return schoolEnquiryPath(school);
}

function formatFee(value: string | null) {
  if (value == null || value === "") return "Fee on request";
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Fee on request";
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L / yr`;
  }
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)} / yr`;
}

function FeaturedSchoolCover({ school }: { school: SchoolListItem }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const initials = (school.short_name || school.school_name).slice(0, 2);
  const photo = school.school_image_url || school.school_photos?.[0]?.photo_url || "";

  return (
    <div className="featured-card__cover">
      {school.is_featured && <span className="featured-card__tag">Featured</span>}
      {photo && !photoFailed ? (
        <Image
          className="featured-card__photo"
          src={photo}
          alt={`${school.school_name} campus`}
          fill
          sizes="(max-width: 720px) 100vw, 280px"
          unoptimized
          onError={() => setPhotoFailed(true)}
        />
      ) : null}
      <div className="featured-card__logo">
        {school.school_logo_url && !logoFailed ? (
          <Image
            src={school.school_logo_url}
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

export default function FeaturedSchoolCards({
  schools,
}: {
  schools: SchoolListItem[];
}) {
  return (
    <div className="featured-cards">
      {schools.map((school) => {
        const boards = school.boards_detail.map((item) => item.board_name).join("/") || "Board on request";
        const location = [school.city_name, school.state_name].filter(Boolean).join(", ");

        return (
          <article className="featured-card featured-card--compact" key={school.school_id}>
            <Link className="featured-card__details" href={schoolHref(school)}>
              <FeaturedSchoolCover school={school} />
              <h3>{school.school_name}</h3>
              <p className="featured-card__place">
                <MapPin size={13} />
                {location || "Location on request"}
              </p>
              <p className="featured-card__meta">{boards} · {formatFee(school.annual_fee)}</p>
              {school.verification_status?.toLowerCase() === "verified" && (
                <span className="featured-card__rating">
                  <CheckCircle2 size={12} /> Verified
                </span>
              )}
            </Link>
            <div className="featured-card__actions">
              <Link className="featured-card__cta" href={schoolHref(school)}>
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
  );
}
