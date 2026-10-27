"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, MapPin, X } from "lucide-react";
import type { IndiaRegionId } from "@/lib/india-regions";

export type IndiaRegionOption = {
  id: IndiaRegionId;
  label: string;
  count?: number;
};

export default function IndiaRegionPickerModal({
  open,
  regions,
  onChoose,
  onClose,
}: {
  open: boolean;
  regions: IndiaRegionOption[];
  onChoose: (region: IndiaRegionId) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="type-picker-modal region-picker-modal"
      aria-labelledby="india-region-picker-title"
      aria-describedby="india-region-picker-description"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
    >
      <button
        className="type-picker-modal__close"
        type="button"
        aria-label="Close region selection"
        onClick={() => dialogRef.current?.close()}
      >
        <X size={20} aria-hidden />
      </button>

      <div className="type-picker-modal__intro">
        <h2 id="india-region-picker-title">Choose an Indian region</h2>
        <p id="india-region-picker-description">
          Narrow your school search to a region before loading listings.
        </p>
      </div>

      <div className="region-picker-modal__options">
        {regions.map((region) => (
          <button
            className="region-picker-modal__option"
            key={region.id}
            type="button"
            onClick={() => onChoose(region.id)}
          >
            <span className="region-picker-modal__icon" aria-hidden>
              <MapPin size={18} />
            </span>
            <span>
              <strong>{region.label}</strong>
              <small>
                {region.count !== undefined && region.count > 0
                  ? `${region.count.toLocaleString()} schools listed`
                  : "Browse schools in this region"}
              </small>
            </span>
            <ArrowRight size={16} aria-hidden />
          </button>
        ))}
      </div>
    </dialog>
  );
}
