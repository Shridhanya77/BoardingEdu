"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { publicSchoolImageUrl } from "@/lib/school-media";

type SchoolPhoto = {
  photo_id: string;
  photo_url: string;
  caption: string;
  alt_text: string;
  category: string;
  sort_order: number;
};

export default function SchoolPhotoGallery({
  photos,
  schoolName,
}: {
  photos: SchoolPhoto[];
  schoolName: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [category, setCategory] = useState("All");
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(() => new Set());
  const visible = photos.filter((photo) => !failedPhotoIds.has(photo.photo_id));
  const categories = ["All", ...Array.from(new Set(visible.map((photo) => photo.category || "OTHER")))];
  const filtered = category === "All" ? visible : visible.filter((photo) => (photo.category || "OTHER") === category);
  const activePhoto = activeIndex != null ? filtered[activeIndex] : null;

  useEffect(() => {
    if (activeIndex == null) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((index) => (index == null ? 0 : (index + 1) % Math.max(filtered.length, 1)));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((index) => (index == null ? 0 : (index - 1 + filtered.length) % Math.max(filtered.length, 1)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [activeIndex, filtered.length]);

  if (!visible.length) {
    return <p className="empty-state">School photos have not been published yet.</p>;
  }

  return (
    <section className="school-gallery" aria-label={`${schoolName} gallery`}>
      <nav className="school-gallery__nav" aria-label="Photo categories">
        {categories.map((item) => {
          const label = item === "All"
            ? "All"
            : item.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
          const count = item === "All"
            ? visible.length
            : visible.filter((photo) => (photo.category || "OTHER") === item).length;
          return (
            <button
              key={item}
              type="button"
              className={item === category ? "is-active" : undefined}
              aria-pressed={item === category}
              aria-label={`${label}: ${count} photos`}
              onClick={() => {
                setCategory(item);
                setActiveIndex(null);
              }}
            >
              {label}<span className="school-gallery__nav-count">{count}</span>
            </button>
          );
        })}
      </nav>
      <p className="school-gallery__hint">
        {filtered.length} {filtered.length === 1 ? "photo" : "photos"} · Select a photo to view it full size.
      </p>
      {!filtered.length && <p className="empty-state">No photos in this category.</p>}
      <ul className="school-gallery__grid">
        {filtered.map((photo, index) => (
          <li key={photo.photo_id}>
            <button
              className="school-gallery__item"
              type="button"
              aria-label={`View ${photo.caption || photo.alt_text || `${schoolName} photo`}`}
              onClick={() => setActiveIndex(index)}
            >
              <Image
                src={publicSchoolImageUrl(photo.photo_url)}
                alt={photo.alt_text || photo.caption || `${schoolName} photo`}
                fill
                sizes="(max-width: 700px) 50vw, 33vw"
                unoptimized
                onError={() => setFailedPhotoIds((current) => new Set(current).add(photo.photo_id))}
              />
              {photo.caption ? <span>{photo.caption.replaceAll("_", " ")}</span> : null}
            </button>
          </li>
        ))}
      </ul>

      {activePhoto ? (
        <div
          className="school-gallery__lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo viewer for ${schoolName}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setActiveIndex(null);
          }}
        >
          <button className="school-gallery__lightbox-close" type="button" onClick={() => setActiveIndex(null)} aria-label="Close photo">
            <X size={22} />
          </button>
          {filtered.length > 1 && (
            <>
              <button
                className="school-gallery__lightbox-control school-gallery__lightbox-control--previous"
                type="button"
                aria-label="Previous photo"
                onClick={() => setActiveIndex((index) => (index == null ? 0 : (index - 1 + filtered.length) % filtered.length))}
              >
                <ChevronLeft size={24} aria-hidden />
              </button>
              <button
                className="school-gallery__lightbox-control school-gallery__lightbox-control--next"
                type="button"
                aria-label="Next photo"
                onClick={() => setActiveIndex((index) => (index == null ? 0 : (index + 1) % filtered.length))}
              >
                <ChevronRight size={24} aria-hidden />
              </button>
            </>
          )}
          <figure className="school-gallery__lightbox-figure">
            <Image
              src={publicSchoolImageUrl(activePhoto.photo_url)}
              alt={activePhoto.alt_text || activePhoto.caption || schoolName}
              width={1400}
              height={900}
              unoptimized
              priority
            />
            <figcaption>
              <span>{activePhoto.caption || activePhoto.alt_text || schoolName}</span>
              {filtered.length > 1 && (
                <span className="school-gallery__lightbox-count">
                  {(activeIndex ?? 0) + 1} of {filtered.length}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </section>
  );
}
