"use client";

import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { SchoolListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs, schoolTypeLabel } from "@/lib/seo-slugs";

function schoolHref(school: SchoolListItem) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
  });
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
  const [imageFailed, setImageFailed] = useState(false);
  const initials = school.short_name || school.school_name.slice(0, 2);

  return (
    <div className="featured-card__cover">
      {school.is_featured && <span className="featured-badge">FEATURED</span>}
      {school.school_image_url && !imageFailed && (
        <Image
          className="featured-card__cover-image"
          src={school.school_image_url}
          alt=""
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
          unoptimized
          aria-hidden="true"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="featured-card__logo">
        {school.school_logo_url && !logoFailed ? (
          <Image
            src={school.school_logo_url}
            alt={`${school.school_name} logo`}
            width={88}
            height={88}
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
        const type = school.school_types_detail
          .map((item) => schoolTypeLabel(item.type_code, item.slug, item.type_name))
          .join(", ") || "School type not listed";
        const location = [school.city_name, school.state_name].filter(Boolean).join(", ");
        const highlights = [
          school.gender,
          school.established_year ? `Est. ${school.established_year}` : null,
        ]
          .filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index)
          .slice(0, 2);

        return (
          <article className="featured-card" key={school.school_id}>
            <FeaturedSchoolCover school={school} />
            <div className="featured-card__badges">
              <span>{boards}</span>
              <span>{type}</span>
            </div>
            <h3>{school.school_name}</h3>
            <p className="featured-card__place">
              <MapPin size={14} />
              {location || "Location on request"}
            </p>
            {school.verification_status?.toLowerCase() === "verified" && (
              <div className="featured-card__rating">
                <CheckCircle2 size={13} />
                Verified profile
              </div>
            )}
            <dl>
              <dt>Annual Fee</dt>
              <dd>{formatFee(school.annual_fee)}</dd>
            </dl>
            <div className="featured-card__facilities">
              {highlights.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <Link href={schoolHref(school)}>
              View School <ArrowRight size={14} />
            </Link>
            <Link className="featured-card__enquiry" href={`${schoolHref(school)}#school-enquiry`}>
              Send Enquiry <ArrowRight size={14} />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
