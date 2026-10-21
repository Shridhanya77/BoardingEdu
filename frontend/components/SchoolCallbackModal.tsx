"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import type { SchoolDetail } from "@/lib/api";
import SchoolCallbackForm from "./SchoolCallbackForm";

export default function SchoolCallbackModal({ school }: { school: SchoolDetail }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        className="school-callback-trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        <CalendarDays size={17} aria-hidden />
        Request a Callback
      </button>
      <dialog
        ref={dialogRef}
        className="school-callback-modal"
        aria-label={`Request a callback about ${school.school_name}`}
        onClose={() => setOpen(false)}
      >
        <button
          className="school-callback-modal__close"
          type="button"
          aria-label="Close callback form"
          onClick={() => dialogRef.current?.close()}
        >
          <X size={20} aria-hidden />
        </button>
        <SchoolCallbackForm school={school} />
      </dialog>
    </>
  );
}
