"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useSearchExperience } from "@/lib/search-experience";
import { trackSearchEvent } from "@/lib/search-analytics";

export default function CompareBar() {
  const [dismissedSelection, setDismissedSelection] = useState<string | null>(null);
  const {
    comparedSchools,
    hydrated,
    limitReached,
    storageError,
    removeSchool,
  } = useSearchExperience();

  const selectionKey = comparedSchools.map((school) => school.school_id).join("|");
  if (!hydrated || comparedSchools.length === 0 || dismissedSelection === selectionKey) return null;

  return (
    <aside className="compare-bar" aria-label="Selected schools for comparison">
      <div className="compare-bar__schools">
        <strong>Compare {comparedSchools.length}/3</strong>
        {comparedSchools.map((school) => (
          <span className="compare-bar__school" key={school.school_id}>
            {school.school_name}
            <button
              type="button"
              onClick={() => removeSchool(school.school_id)}
              aria-label={`Remove ${school.school_name} from comparison`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <div className="compare-bar__actions">
        {limitReached && (
          <span role="status">Your shortlist is full. Compare up to three schools at a time.</span>
        )}
        {storageError && <span role="status">{storageError}</span>}
        <Link
          href="/compare"
          onClick={() => trackSearchEvent("compare_opened")}
        >
          Compare schools <ArrowRight size={15} />
        </Link>
        <button
          className="compare-bar__dismiss"
          type="button"
          onClick={() => setDismissedSelection(selectionKey)}
          aria-label="Dismiss comparison bar"
        >
          <X size={17} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
