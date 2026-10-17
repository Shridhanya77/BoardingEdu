import type { SchoolTypeListItem } from "@/lib/api";
import { schoolTypeCategory } from "@/lib/seo-slugs";

export type SavedCountryPreference = {
  country_id: string;
  state_ids: string[];
};

export type LocationPreferences = {
  version: 2;
  countries: SavedCountryPreference[];
  updated_at: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBoardingOnlySelection(
  typeIds: string[],
  schoolTypes: SchoolTypeListItem[],
): boolean {
  return (
    typeIds.length > 0 &&
    typeIds.every((id) => {
      const type = schoolTypes.find((item) => item.school_type_id === id);
      if (!type) return false;
      const category = schoolTypeCategory(type.type_code, type.slug, type.type_name);
      return category === "day-boarding-school" || category === "boarding-school";
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) return null;
  return value.toLowerCase();
}

function normalizeCountries(value: unknown): SavedCountryPreference[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const countries: SavedCountryPreference[] = [];
  const seenCountries = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry) || !Array.isArray(entry.state_ids)) return null;
    const countryId = normalizeId(entry.country_id);
    if (!countryId || seenCountries.has(countryId) || entry.state_ids.length > 500) {
      return null;
    }
    seenCountries.add(countryId);

    const stateIds: string[] = [];
    for (const rawStateId of entry.state_ids) {
      const stateId = normalizeId(rawStateId);
      if (!stateId) return null;
      if (!stateIds.includes(stateId)) stateIds.push(stateId);
    }
    countries.push({ country_id: countryId, state_ids: stateIds });
  }
  return countries;
}

function normalizeLegacyPreferences(value: Record<string, unknown>): LocationPreferences | null {
  if (!Array.isArray(value.active_school_type_ids) || !isRecord(value.preferences)) {
    return null;
  }

  const grouped = new Map<string, Set<string>>();
  for (const rawLocation of Object.values(value.preferences)) {
    if (!isRecord(rawLocation)) return null;
    const countryId = normalizeId(rawLocation.country_id);
    const stateId =
      rawLocation.state_id === null ? null : normalizeId(rawLocation.state_id);
    if (!countryId || (rawLocation.state_id !== null && !stateId)) return null;
    const states = grouped.get(countryId) ?? new Set<string>();
    if (stateId) states.add(stateId);
    grouped.set(countryId, states);
  }
  if (grouped.size > 50) return null;

  return {
    version: 2,
    countries: [...grouped].map(([country_id, states]) => ({
      country_id,
      state_ids: [...states],
    })),
    updated_at: new Date().toISOString(),
  };
}

export function normalizeLocationPreferences(
  value: unknown,
): LocationPreferences | null {
  if (!isRecord(value)) return null;
  if (value.version === 1) return normalizeLegacyPreferences(value);
  if (value.version !== 2) return null;

  const countries = normalizeCountries(value.countries);
  if (!countries) return null;
  const updatedAt =
    typeof value.updated_at === "string" &&
    Number.isFinite(Date.parse(value.updated_at))
      ? value.updated_at
      : new Date().toISOString();

  return { version: 2, countries, updated_at: updatedAt };
}

export function createLocationPreferences(
  countries: SavedCountryPreference[],
): LocationPreferences {
  return {
    version: 2,
    countries: countries.map(({ country_id, state_ids }) => ({
      country_id,
      state_ids: [...new Set(state_ids)],
    })),
    updated_at: new Date().toISOString(),
  };
}
