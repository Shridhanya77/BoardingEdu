"use client";

import { useState } from "react";

export default function ReadMore({ text, limit = 260 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const trimmed = text.trim();
  const long = trimmed.length > limit;
  const shown = !long || open ? trimmed : `${trimmed.slice(0, limit).trim()}…`;

  return (
    <div className="read-more">
      <p>{shown}</p>
      {long && (
        <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
