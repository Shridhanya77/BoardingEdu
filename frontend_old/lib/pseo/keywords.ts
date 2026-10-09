// lib/pseo/keywords.ts
import type { ParsedSlug } from './parse-slug';
import { CITY_OVERRIDES } from './city-overrides';

/**
 * Generates meta keywords for a pSEO page.
 *
 * Priority order:
 *   1. If city has a custom override → use its keywords generator
 *   2. Otherwise → generic template keyed on slug depth
 *
 * Returns de-duplicated, lowercase keyword array.
 */
export function generateKeywords(p: ParsedSlug): string[] {
  const type = p.category
    ? p.category.replace(/-/g, ' ')
    : 'schools';
  const affUpper = p.affiliation?.toUpperCase();
  const affLower = p.affiliation?.toLowerCase();

  // Location string at highest specificity available
  const loc = p.location
    ? `${p.location}, ${p.city ?? p.state ?? p.country}`
    : p.city ?? p.state ?? p.country;

  // Custom override path
  if (p.city && CITY_OVERRIDES[p.city]) {
    return dedupe(CITY_OVERRIDES[p.city].keywords(type, p.affiliation, p.city));
  }

  // Generic fallback
  const kw: string[] = [
    `best ${type} in ${loc}`,
    `top ${type} ${loc}`,
    `${affLower ? affLower + ' ' : ''}${type} ${loc}`,
    `${type} ${loc} admissions 2026`,
    `${type} ${loc} fees`,
    `compare ${type} ${loc}`,
    `${affUpper ? affUpper + ' ' : ''}${type} near me`,
  ];

  // Add category-specific long-tail
  if (p.category === 'boarding-schools') {
    kw.push(`best boarding schools ${loc}`, `residential schools ${loc}`);
  }
  if (p.category === 'day-boarding-schools') {
    kw.push(`day boarding schools ${loc}`, `extended day schools ${loc}`);
  }

  return dedupe(kw);
}

/**
 * Normalizes + de-duplicates keywords.
 *   - Lowercase
 *   - Trim whitespace
 *   - Drop empties
 *   - Cap at 15 keywords (SEO best practice)
 */
function dedupe(arr: string[]): string[] {
  const set = new Set<string>();
  for (const k of arr) {
    const clean = k.trim().toLowerCase();
    if (clean) set.add(clean);
    if (set.size >= 15) break;
  }
  return Array.from(set);
}