"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SchoolPhoto = {
  photo_id: string;
  photo_url: string;
  caption: string;
  alt_text: string;
  sort_order: number;
};

export default function SchoolPhotoGallery({
  photos,
  schoolName,
}: {
  photos: SchoolPhoto[];
  schoolName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedIndex = activeIndex % photos.length;
  const activePhoto = photos[selectedIndex];
  const imageFailed = failedPhotoIds.has(activePhoto.photo_id);

  function markImageFailed(photoId: string) {
    setFailedPhotoIds((current) => new Set(current).add(photoId));
  }

  function showPrevious() {
    setActiveIndex((index) => (index - 1 + photos.length) % photos.length);
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % photos.length);
  }

  return (
    <section className="school-detail__gallery" aria-label={`${schoolName} photos`}>
      <div className="school-detail__gallery-stage">
        {imageFailed ? (
          <p className="school-detail__gallery-fallback">
            {activePhoto.caption || "Campus photo is currently unavailable."}
          </p>
        ) : (
          <Image
            key={activePhoto.photo_id}
            src={activePhoto.photo_url}
            alt={activePhoto.alt_text || `${schoolName} campus`}
            fill
            priority={selectedIndex === 0}
            sizes="(max-width: 900px) 100vw, 1060px"
            unoptimized
            onError={() => markImageFailed(activePhoto.photo_id)}
          />
        )}

        {photos.length > 1 && (
          <>
            <button
              className="school-detail__gallery-arrow school-detail__gallery-arrow--previous"
              type="button"
              onClick={showPrevious}
              aria-label="Show previous school photo"
            >
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button
              className="school-detail__gallery-arrow school-detail__gallery-arrow--next"
              type="button"
              onClick={showNext}
              aria-label="Show next school photo"
            >
              <ChevronRight size={22} aria-hidden />
            </button>
            <span className="school-detail__gallery-count" aria-live="polite">
              {selectedIndex + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {activePhoto.caption && !imageFailed && (
        <p className="school-detail__gallery-caption">{activePhoto.caption}</p>
      )}

      {photos.length > 1 && (
        <div className="school-detail__gallery-thumbnails" aria-label="Choose a school photo">
          {photos.map((photo, index) => (
            <button
              className={`school-detail__gallery-thumbnail${index === selectedIndex ? " is-active" : ""}`}
              key={photo.photo_id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ""}`}
              aria-current={index === selectedIndex ? "true" : undefined}
            >
              {failedPhotoIds.has(photo.photo_id) ? (
                <span className="school-detail__gallery-thumbnail-fallback" aria-hidden>
                  {index + 1}
                </span>
              ) : (
                <Image
                  src={photo.photo_url}
                  alt=""
                  width={120}
                  height={72}
                  unoptimized
                  onError={() => markImageFailed(photo.photo_id)}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
