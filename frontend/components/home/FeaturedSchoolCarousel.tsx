"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SchoolListItem } from "@/lib/api";
import FeaturedSchoolCards from "./FeaturedSchoolCards";

export function FeaturedSchoolMarquee({
  schools,
  label = "Featured schools",
}: {
  schools: SchoolListItem[];
  label?: string;
}) {
  if (!schools.length) return null;
  return (
    <div className="featured-marquee" role="region" aria-label={label} tabIndex={0}>
      <div className="featured-marquee__track">
        <FeaturedSchoolCards schools={schools} keyPrefix="a-" />
        <div className="featured-marquee__copy" aria-hidden="true" inert>
          <FeaturedSchoolCards schools={schools} keyPrefix="b-" />
        </div>
      </div>
    </div>
  );
}

export default function FeaturedSchoolCarousel({
  schools,
  label = "Featured schools",
}: {
  schools: SchoolListItem[];
  label?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    if (max <= 8) {
      viewport.scrollTo({ left: 0, behavior: "auto" });
      return;
    }
    const positions = [...viewport.querySelectorAll<HTMLElement>(".featured-card")]
      .map((card) => card.offsetLeft);
    const current = viewport.scrollLeft;
    const target = direction > 0
      ? positions.find((left) => left > current + 8)
      : [...positions].reverse().find((left) => left < current - 8);
    const left = target == null
      ? (direction > 0 ? 0 : Math.max(0, positions[0] ?? 0))
      : Math.min(target, max);
    viewport.scrollTo({
      left,
      behavior: target == null && direction > 0 ? "auto" : "smooth",
    });
  }

  return (
    <div className="featured-school-carousel">
      <div className="featured-school-carousel__controls" role="group" aria-label={`${label} carousel controls`}>
        <button type="button" onClick={() => scroll(-1)} aria-label="Show previous schools">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button type="button" onClick={() => scroll(1)} aria-label="Show more schools">
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
      <div className="featured-school-carousel__viewport" ref={viewportRef} tabIndex={0} role="region" aria-label={label}>
        <FeaturedSchoolCards schools={schools} />
      </div>
    </div>
  );
}
