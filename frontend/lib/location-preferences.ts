export type SavedLocationPreference = {
  country_id: string;
  state_id: string | null;
  city_id: string | null;
  location_id: string | null;
};

export type LocationPreferences = {
  version: 1;
  active_school_type_ids: string[];
  preferences: Record<string, SavedLocationPreference>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCATION_FIELDS = [
  "country_id",
  "state_id",
  "city_id",
  "location_id",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeId(value: unknown, allowNull = false): string | null | undefined {
  if (allowNull && value === null) return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) return undefined;
  return value.toLowerCase();
}

export function normalizeLocationPreferences(
  value: unknown,
): LocationPreferences | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (!Array.isArray(value.active_school_type_ids) || !isRecord(value.preferences)) {
    return null;
  }

  const preferenceEntries = Object.entries(value.preferences);
  if (
    value.active_school_type_ids.length > 20 ||
    preferenceEntries.length > 50
  ) {
    return null;
  }

  const preferences: Record<string, SavedLocationPreference> = {};
  for (const [rawTypeId, rawLocation] of preferenceEntries) {
    const typeId = normalizeId(rawTypeId);
    if (!typeId || !isRecord(rawLocation)) return null;
    if (Object.keys(rawLocation).some((key) => !LOCATION_FIELDS.includes(key as typeof LOCATION_FIELDS[number]))) {
      return null;
    }

    const countryId = normalizeId(rawLocation.country_id);
    const stateId = normalizeId(rawLocation.state_id, true);
    const cityId = normalizeId(rawLocation.city_id, true);
    const locationId = normalizeId(rawLocation.location_id, true);
    if (
      !countryId ||
      stateId === undefined ||
      cityId === undefined ||
      locationId === undefined ||
      (stateId && !countryId) ||
      (cityId && !stateId) ||
      (locationId && !cityId)
    ) {
      return null;
    }

    preferences[typeId] = {
      country_id: countryId,
      state_id: stateId,
      city_id: cityId,
      location_id: locationId,
    };
  }

  const activeTypeIds: string[] = [];
  for (const rawId of value.active_school_type_ids) {
    const typeId = normalizeId(rawId);
    if (!typeId || !preferences[typeId]) return null;
    if (!activeTypeIds.includes(typeId)) activeTypeIds.push(typeId);
  }

  if (activeTypeIds.length === 0 && preferenceEntries.length !== 0) return null;

  return {
    version: 1,
    active_school_type_ids: activeTypeIds,
    preferences,
  };
}
