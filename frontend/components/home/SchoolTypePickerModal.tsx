"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap, House, X } from "lucide-react";
import type { HomeSchoolCategory } from "@/lib/seo-slugs";

export type SchoolTypePickerRequest = {
  /** Heading shown inside the popup, e.g. "Schools in Mumbai". */
  title: string;
  subtitle: string;
  /** Where each family choice leads — always a clean trailing-slash path. */
  hrefFor: (category: HomeSchoolCategory) => string;
  /** Unfiltered listing for the same place or board. */
  allHref: string;
  allLabel: string;
};

const OPTIONS: { category: HomeSchoolCategory; title: string; text: string }[] = [
  {
    category: "day-school",
    title: "Day Schools",
    text: "Regular school hours — students travel home at the end of the day.",
  },
  {
    category: "residential-school",
    title: "Boarding Schools",
    text: "Day boarding and full boarding schools with residential care.",
  },
];

export default function SchoolTypePickerModal({
  request,
  onClose,
}: {
  request: SchoolTypePickerRequest | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  return (
    <dialog
      ref={dialogRef}
      className="type-picker-modal"
      aria-label={request?.title ?? "Choose a school type"}
      onClose={onClose}
    >
      <button
        className="type-picker-modal__close"
        type="button"
        aria-label="Close"
        onClick={() => dialogRef.current?.close()}
      >
        <X size={20} aria-hidden />
      </button>

      {request && (
        <>
          <div className="type-picker-modal__intro">
            <span className="section-eyebrow">CHOOSE A SCHOOL TYPE</span>
            <h2>{request.title}</h2>
            <p>{request.subtitle}</p>
          </div>

          <div className="type-picker-modal__options">
            {OPTIONS.map((option) => (
              <Link
                className="type-picker-modal__option"
                href={request.hrefFor(option.category)}
                key={option.category}
                onClick={onClose}
              >
                <span className="type-picker-modal__icon" aria-hidden>
                  {option.category === "day-school" ? (
                    <GraduationCap size={20} />
                  ) : (
                    <House size={20} />
                  )}
                </span>
                <strong>{option.title}</strong>
                <small>{option.text}</small>
                <span className="type-picker-modal__action">
                  Browse {option.title.toLowerCase()} <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>

          <Link className="type-picker-modal__all" href={request.allHref} onClick={onClose}>
            {request.allLabel} <ArrowRight size={14} />
          </Link>
        </>
      )}
    </dialog>
  );
}
