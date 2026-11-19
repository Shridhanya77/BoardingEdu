export const SEARCH_PALETTE_OPEN_EVENT = "boardingeu:open-search-palette";
export const SEARCH_HISTORY_UPDATED_EVENT = "boardingeu:search-history-updated";

export function requestSearchPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SEARCH_PALETTE_OPEN_EVENT));
  }
}
