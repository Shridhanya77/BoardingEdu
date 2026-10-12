"use client";

import { useRef } from "react";

export type SeoPlace = {
  key: string;
  label: string;
  kind: "city" | "state";
};

export default function SeoPlaceMarquee({
  places,
  onSelect,
}: {
  places: SeoPlace[];
  onSelect: (place: SeoPlace) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  function maybeAdvance(event: React.MouseEvent<HTMLButtonElement>) {
    const parent = scroller.current;
    if (!parent) return;
    const chip = event.currentTarget.getBoundingClientRect();
    const track = parent.getBoundingClientRect();
    if (chip.right > track.right - 48) {
      parent.scrollBy({ left: chip.width + 12, behavior: "smooth" });
    }
  }

  return (
    <div className="seo-marquee" ref={scroller} role="list">
      {places.map((place) => (
        <button
          type="button"
          role="listitem"
          className={`seo-chip seo-chip--${place.kind}`}
          key={place.key}
          onMouseEnter={maybeAdvance}
          onClick={() => onSelect(place)}
        >
          <small>{place.kind === "city" ? "City" : "State"}</small>
          {place.label}
        </button>
      ))}
    </div>
  );
}
