export type SearchEventName =
  | "search_opened"
  | "search_query_submitted"
  | "search_autocomplete_selected"
  | "filter_applied"
  | "filter_cleared"
  | "school_compared"
  | "compare_opened"
  | "voice_started"
  | "voice_completed";

const CONSENT_KEY = "boardingeu:search-analytics-consent";
const SESSION_KEY = "boardingeu:search-analytics-session";

export function getSearchAnalyticsConsent(): "accepted" | "declined" | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function setSearchAnalyticsConsent(value: "accepted" | "declined") {
  window.localStorage.setItem(CONSENT_KEY, value);
}

export function trackSearchEvent(
  name: SearchEventName,
  props: Record<string, string | number | boolean | string[]> = {},
  sendImmediately = false
) {
  if (
    typeof window === "undefined" ||
    getSearchAnalyticsConsent() !== "accepted"
  ) {
    return;
  }

  let sessionId: string | null = null;
  try {
    sessionId = window.sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = window.crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, sessionId);
    }
  } catch {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("boardingeu:search-analytics", {
      detail: {
        name,
        props,
        sessionId,
        timestamp: new Date().toISOString(),
        sendImmediately,
      },
    })
  );
}
