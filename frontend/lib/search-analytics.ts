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
const CONSENT_COOKIE = "boardingeu_analytics_consent";

export function getSearchAnalyticsConsent(): "accepted" | "declined" | null {
  if (typeof window === "undefined") return null;
  const readCookie = () => {
    const cookie = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
      ?.slice(CONSENT_COOKIE.length + 1);
    return cookie === "accepted" || cookie === "declined" ? cookie : null;
  };
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : readCookie();
  } catch {
    return readCookie();
  }
}

export function setSearchAnalyticsConsent(value: "accepted" | "declined") {
  if (typeof window === "undefined") return;
  let persisted = false;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
    persisted = true;
  } catch {
    // Use the first-party cookie below when mobile/private browsing blocks storage.
  }
  try {
    document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    persisted = document.cookie
      .split("; ")
      .some((part) => part === `${CONSENT_COOKIE}=${value}`) || persisted;
  } catch {
    if (!persisted) throw new Error("Your analytics preference could not be saved in this browser.");
  }
  if (!persisted) throw new Error("Your analytics preference could not be saved in this browser.");
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
