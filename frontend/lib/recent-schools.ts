export const RECENT_SCHOOLS_STORAGE_KEY = "boardingeu:recent-school-ids";
export const RECENT_SCHOOLS_LIMIT = 8;

export function readRecentSchoolIds(): string[] {
  const raw = window.localStorage.getItem(RECENT_SCHOOLS_STORAGE_KEY);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("Recently viewed schools data is invalid.");
  }
  return value.slice(0, RECENT_SCHOOLS_LIMIT);
}

export function saveRecentSchoolIds(schoolIds: string[]) {
  window.localStorage.setItem(
    RECENT_SCHOOLS_STORAGE_KEY,
    JSON.stringify([...new Set(schoolIds)].slice(0, RECENT_SCHOOLS_LIMIT)),
  );
}
