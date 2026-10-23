"use client";

import { useEffect, useState } from "react";
import {
  getSearchAnalyticsConsent,
  setSearchAnalyticsConsent,
} from "@/lib/search-analytics";

export default function SearchAnalyticsConsent() {
  const [visible, setVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setVisible(getSearchAnalyticsConsent() === null);
    } catch {
      setVisible(true);
    }
  }, []);

  function choose(value: "accepted" | "declined") {
    try {
      setSearchAnalyticsConsent(value);
      setVisible(false);
      setSaveError(null);
    } catch {
      setSaveError("Your preference could not be saved. Please allow site storage and try again.");
    }
  }

  if (!visible) return null;

  return (
    <aside className="search-consent" aria-label="Analytics preference">
      <p>
        Allow anonymous search-usage analytics? Search terms and personal
        details are not included.
      </p>
      {saveError && <p className="search-consent__error" role="alert">{saveError}</p>}
      <div>
        <button type="button" onClick={() => choose("declined")}>
          Decline
        </button>
        <button type="button" onClick={() => choose("accepted")}>
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
