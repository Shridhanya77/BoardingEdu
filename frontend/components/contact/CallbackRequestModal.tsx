"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import CallbackRequestForm from "./CallbackRequestForm";

export default function CallbackRequestModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="callback-request-modal"
      aria-label="Request a callback from BoardingEdu"
      onClose={onClose}
    >
      <button
        className="callback-request-modal__close"
        type="button"
        aria-label="Close callback request"
        onClick={() => dialogRef.current?.close()}
      >
        <X size={20} aria-hidden />
      </button>
      <CallbackRequestForm titleId="callback-request-modal-title" />
    </dialog>
  );
}
