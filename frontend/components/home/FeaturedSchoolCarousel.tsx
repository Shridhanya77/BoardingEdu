"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SchoolListItem } from "@/lib/api";
import FeaturedSchoolCards from "./FeaturedSchoolCards";

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
    viewport.scrollBy({
      left: direction * Math.max(viewport.clientWidth * 0.8, 240),
      behavior: "smooth",
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
