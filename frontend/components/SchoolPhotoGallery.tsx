"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
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
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(() => new Set());
  const visible = photos.filter((photo) => !failedPhotoIds.has(photo.photo_id));
  const activePhoto = activeIndex != null ? visible[activeIndex] : null;

  useEffect(() => {
    if (activeIndex == null) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowRight") {
        setActiveIndex((index) => (index == null ? 0 : (index + 1) % Math.max(visible.length, 1)));
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((index) => (index == null ? 0 : (index - 1 + visible.length) % Math.max(visible.length, 1)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, visible.length]);

  if (!visible.length) {
    return <p className="empty-state">School photos have not been published yet.</p>;
  }

  return (
    <section className="school-gallery" aria-label={`${schoolName} gallery`}>
      <ul className="school-gallery__grid">
        {visible.map((photo, index) => (
          <li key={photo.photo_id}>
            <button
              className="school-gallery__item"
              type="button"
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
        <div className="school-gallery__lightbox" role="dialog" aria-modal="true" aria-label={activePhoto.caption || schoolName}>
          <button className="school-gallery__lightbox-close" type="button" onClick={() => setActiveIndex(null)} aria-label="Close photo">
            <X size={22} />
          </button>
          <Image
            src={publicSchoolImageUrl(activePhoto.photo_url)}
            alt={activePhoto.alt_text || activePhoto.caption || schoolName}
            width={1400}
            height={900}
            unoptimized
          />
          {visible.length > 1 ? (
            <p>{(activeIndex ?? 0) + 1} / {visible.length}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
