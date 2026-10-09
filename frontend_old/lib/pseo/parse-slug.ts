// lib/pseo/parse-slug.ts
export interface ParsedSlug {
  category?: 'day-schools' | 'boarding-schools' | 'day-boarding-schools';
  country: string;
  state?: string;
  city?: string;
  location?: string;
  affiliation?: 'cbse' | 'icse' | 'ib' | 'igcse' | 'state-board';
}

const CATEGORIES = new Set(['day-schools', 'boarding-schools', 'day-boarding-schools']);
const AFFILIATIONS = new Set(['cbse', 'icse', 'ib', 'igcse', 'state-board']);
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseSlug(slug: string[]): ParsedSlug | null {
  if (!slug.length) return null;
  if (!slug.every(s => SLUG_REGEX.test(s))) return null;

  const parts = [...slug];
  let category: ParsedSlug['category'];
  let affiliation: ParsedSlug['affiliation'];

  if (CATEGORIES.has(parts[0])) {
    category = parts.shift() as ParsedSlug['category'];
  }
  if (parts.length && AFFILIATIONS.has(parts[parts.length - 1])) {
    affiliation = parts.pop() as ParsedSlug['affiliation'];
  }

  const [country, state, city, location] = parts;
  if (!country) return null;
  if (parts.length > 4) return null;

  return { category, country, state, city, location, affiliation };
}

export async function validateGeography(p: ParsedSlug): Promise<boolean> {
  if (p.state && !(await stateExistsInCountry(p.state, p.country))) return false;
  if (p.city && !(await cityExistsInState(p.city, p.state!))) return false;
  if (p.location && !(await locationExistsInCity(p.location, p.city!))) return false;
  return true;
}