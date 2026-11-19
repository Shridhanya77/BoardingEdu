"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function ReadMore({ text, limit = 260 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const trimmed = text.trim();
  const long = trimmed.length > limit;
  const shown = !long || (open && !isMobile) ? trimmed : `${trimmed.slice(0, limit).trim()}…`;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const updateViewport = () => {
      setIsMobile(media.matches);
      if (!media.matches) dialogRef.current?.close();
    };
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  return (
    <div className="read-more">
      <p>{shown}</p>
      {long && (
        <button
          type="button"
          onClick={() => {
            if (isMobile) {
              dialogRef.current?.showModal();
            } else {
              setOpen((current) => !current);
            }
          }}
          aria-expanded={!isMobile && open}
        >
          {!isMobile && open ? "Show less" : "Read more"}
        </button>
      )}
      <dialog ref={dialogRef} className="read-more__dialog" aria-labelledby={titleId}>
        <div className="read-more__dialog-header">
          <h2 id={titleId}>About this school</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close school overview">
            Close
          </button>
        </div>
        <p>{trimmed}</p>
      </dialog>
    </div>
  );
}
