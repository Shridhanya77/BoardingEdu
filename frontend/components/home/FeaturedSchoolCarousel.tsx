"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { SchoolListItem } from "@/lib/api";
import FeaturedSchoolCards from "./FeaturedSchoolCards";

export default function FeaturedSchoolCarousel({
  schools,
  label = "Featured schools",
  autoAdvance = false,
}: {
  schools: SchoolListItem[];
  label?: string;
  autoAdvance?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!autoAdvance || paused || schools.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const step = Math.max(viewport.clientWidth * 0.8, 240);
      const end = viewport.scrollWidth - viewport.clientWidth;
      if (viewport.scrollLeft + step >= end - 8) {
        viewport.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        viewport.scrollBy({ left: step, behavior: "smooth" });
      }
    }, 5200);

    return () => window.clearInterval(timer);
  }, [autoAdvance, paused, schools.length]);

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
        {autoAdvance && (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? "Resume automatic scrolling" : "Pause automatic scrolling"}
            aria-pressed={paused}
          >
            {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
          </button>
        )}
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
