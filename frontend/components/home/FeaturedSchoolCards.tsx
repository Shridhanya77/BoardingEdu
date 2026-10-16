"use client";

import { ArrowRight, MapPin, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { SchoolListItem } from "@/lib/api";
import { schoolProfileTypeSegment } from "@/lib/seo-slugs";

function schoolHref(school: SchoolListItem) {
  return `/${school.country_slug}/${school.state_slug}/${schoolProfileTypeSegment(school.school_types_detail)}/${school.slug}`;
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

export default function FeaturedSchoolCards({
  schools,
}: {
  schools: SchoolListItem[];
}) {
  return (
    <div className="featured-cards">
      {schools.map((school) => {
        const boards = school.boards_detail.map((item) => item.board_name).join("/") || "Board on request";
        const type =
          school.school_types_detail[0]?.type_name ||
          (school.gender === "Girls" || school.gender === "GIRLS"
            ? "Girls' Boarding"
            : school.gender === "Boys" || school.gender === "BOYS"
              ? "Boys' Boarding"
              : "Co-Ed School");
        const location = [school.city_name, school.state_name].filter(Boolean).join(", ");
        const facilities = [
          ...school.school_types_detail.map((item) => item.type_name),
          school.boarding_required ? "Boarding" : null,
          school.gender,
        ]
          .filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index)
          .slice(0, 3);

        return (
          <article className="featured-card" key={school.school_id}>
            <div className="featured-card__cover">
              {school.school_logo_url ? (
                <Image
                  src={school.school_logo_url}
                  alt={`${school.school_name} logo`}
                  width={88}
                  height={88}
                  unoptimized
                />
              ) : (
                <span aria-label={`${school.school_name} logo unavailable`}>
                  {school.short_name || school.school_name.slice(0, 2)}
                </span>
              )}
            </div>
            <div className="featured-card__badges">
              <span>{boards}</span>
              <span>{type}</span>
            </div>
            <h3>{school.school_name}</h3>
            <p className="featured-card__place">
              <MapPin size={14} />
              {location || "Location on request"}
            </p>
            <div className="featured-card__rating">
              <Star size={13} />
              {school.verification_status?.toLowerCase() === "verified" ? "Verified profile" : "Reviews coming soon"}
            </div>
            <dl>
              <dt>Annual Fee Range</dt>
              <dd>{formatFee(school.annual_fee)}</dd>
            </dl>
            <div className="featured-card__facilities">
              {facilities.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <Link href={schoolHref(school)}>
              View School <ArrowRight size={14} />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
