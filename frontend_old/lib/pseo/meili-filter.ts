// lib/pseo/meili-filter.ts
import type { ParsedSlug } from './parse-slug';

export function buildMeiliFilter(p: ParsedSlug): string {
  const filters: string[] = [];

  if (p.category) {
    const typeMap: Record<NonNullable<ParsedSlug['category']>, string> = {
      'day-schools': 'day',
      'boarding-schools': 'boarding',
      'day-boarding-schools': 'day-boarding',
    };
    filters.push(`school_type = "${typeMap[p.category]}"`);
  }

  if (p.country)     filters.push(`country = "${p.country}"`);
  if (p.state)       filters.push(`state = "${p.state}"`);
  if (p.city)        filters.push(`city = "${p.city}"`);
  if (p.location)    filters.push(`locality = "${p.location}"`);
  if (p.affiliation) filters.push(`board = "${p.affiliation}"`);

  return filters.join(' AND ');
}

export function buildCanonical(p: ParsedSlug): string {
  const segments: string[] = [];
  if (p.category)    segments.push(p.category);
  segments.push(p.country);
  if (p.state)       segments.push(p.state);
  if (p.city)        segments.push(p.city);
  if (p.location)    segments.push(p.location);
  if (p.affiliation) segments.push(p.affiliation);

  return `https://boardingedu.com/schools/${segments.join('/')}/`;
}