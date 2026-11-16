"use client";

import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SchoolListItem } from "@/lib/api";
import { boardsAffiliatedLabel } from "@/lib/board-labels";
import { publicSchoolImageUrl, schoolCoverImageUrl } from "@/lib/school-media";
import { schoolProfilePathFromSlugs, schoolTypeLabel } from "@/lib/seo-slugs";

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

function schoolImage(school: SchoolListItem) {
  const banner = school.promotion?.banner_url?.trim();
  if (banner) return publicSchoolImageUrl(banner);
  return schoolCoverImageUrl(school);
}

export default function FeaturedPromoBanner({
  schools,
}: {
  schools: SchoolListItem[];
}) {
  const [index, setIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const count = schools.length;
  const school = schools[Math.min(index, Math.max(count - 1, 0))];

  useEffect(() => {
    setIndex(0);
    setImageFailed(false);
  }, [schools]);

  useEffect(() => {
    setImageFailed(false);
  }, [index]);

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [count]);

  if (!school) return null;

  const promotion = school.promotion;
  const image = imageFailed ? "" : schoolImage(school);
  const location = [school.city_name, school.state_name].filter(Boolean).join(", ");
  const boards = boardsAffiliatedLabel(school.boards_detail);
  const types = Array.from(new Set(
    school.school_types_detail
      .map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name))
      .filter(Boolean),
  ));
  const highlights = promotion?.highlights?.filter(Boolean).slice(0, 4) ?? [];
  const description = promotion?.description?.trim() || school.tagline?.trim() || "";
  const label = promotion?.label_display || "Featured";

  function step(direction: -1 | 1) {
    setIndex((current) => (current + direction + count) % count);
  }

  return (
    <section className="promo-banner" aria-label="Featured schools">
      <div className="promo-banner__frame">
        <div className="promo-banner__visual">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 800px) 100vw, 520px"
              unoptimized
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="promo-banner__fallback" aria-hidden>
              <span>{(school.short_name || school.school_name).slice(0, 2)}</span>
            </div>
          )}
          <span className={`promo-banner__label${promotion?.label === "SPONSORED" ? " promo-banner__label--sponsored" : ""}`}>
            {label}
          </span>
        </div>

        <div className="promo-banner__copy">
          <p className="promo-banner__eyebrow">Promoted schools</p>
          <h2>{school.school_name}</h2>
          {location && (
            <p className="promo-banner__place">
              <MapPin size={15} aria-hidden />
              {location}
            </p>
          )}
          {(boards || types.length > 0) && (
            <p className="promo-banner__facts">
              {[types.join(" · "), boards].filter(Boolean).join(" · ")}
            </p>
          )}
          {description && <p className="promo-banner__description">{description}</p>}
          {highlights.length > 0 && (
            <ul className="promo-banner__highlights">
              {highlights.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
          <div className="promo-banner__actions">
            <Link className="promo-banner__cta" href={schoolHref(school)}>
              Explore School <ArrowRight size={16} aria-hidden />
            </Link>
            {count > 1 && (
              <div className="promo-banner__nav" role="group" aria-label="More featured schools">
                <button type="button" onClick={() => step(-1)} aria-label="Previous featured school">
                  <ChevronLeft size={18} aria-hidden />
                </button>
                <span>{index + 1} / {count}</span>
                <button type="button" onClick={() => step(1)} aria-label="Next featured school">
                  <ChevronRight size={18} aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
