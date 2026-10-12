"use client";

import { useEffect, useState } from "react";
import {
  getSearchAnalyticsConsent,
  setSearchAnalyticsConsent,
} from "@/lib/search-analytics";

export default function SearchAnalyticsConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(getSearchAnalyticsConsent() === null);
    } catch {
      setVisible(false);
    }
  }, []);

  function choose(value: "accepted" | "declined") {
    try {
      setSearchAnalyticsConsent(value);
      setVisible(false);
    } catch {
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <aside className="search-consent" aria-label="Analytics preference">
      <p>
        Allow anonymous search-usage analytics? Search terms and personal
        details are not included.
      </p>
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
