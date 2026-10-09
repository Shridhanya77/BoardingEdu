// lib/pseo/slugify.ts
/**
 * Converts arbitrary text into a URL-safe slug.
 *
 * Handles:
 *   - Unicode normalize:     "Café Résidence"  → "Cafe Residence"
 *   - Accent strip:          → "Cafe Residence"
 *   - Lowercase:             → "cafe residence"
 *   - Apostrophe strip:      "St. Mary's"      → "st marys"
 *   - Non-alnum → hyphen:    "Mumbai (Central)" → "Mumbai-Central"
 *   - Collapse multiple:     "a---b"           → "a-b"
 *   - Trim edges:            "-abc-"           → "abc"
 *   - Length cap:            75 chars (SEO-safe)
 */
export function slugify(input: string): string {
  if (!input) return '';

  return input
    // 1. Unicode NFD — decompose accented chars
    .normalize('NFD')
    // 2. Remove combining diacritical marks
    .replace(/[\u0300-\u036f]/g, '')
    // 3. Lowercase
    .toLowerCase()
    // 4. Strip apostrophes (both straight ' and curly ')
    .replace(/['']/g, '')
    // 5. Replace any non-alphanumeric run with hyphen
    .replace(/[^a-z0-9]+/g, '-')
    // 6. Collapse multiple hyphens
    .replace(/-{2,}/g, '-')
    // 7. Trim leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // 8. Cap at 75 chars
    .slice(0, 75)
    // 9. Re-trim (slice might leave trailing hyphen)
    .replace(/-+$/, '');
}

/**
 * Generates a unique slug. If base already exists, appends -2, -3, … up to -99.
 * Throws if 100 candidates are exhausted (extremely unlikely).
 *
 * @param base     Raw slug candidate (e.g., "st-marys-mumbai")
 * @param exists   Async predicate — returns true if slug already taken
 */
export async function uniqueSlug(
  base: string,
  exists: (s: string) => Promise<boolean>,
  maxAttempts = 100,
): Promise<string> {
  const baseSlug = slugify(base);
  if (!baseSlug) throw new Error('Slug is empty after normalization');

  if (!(await exists(baseSlug))) return baseSlug;

  for (let i = 2; i <= maxAttempts; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(`Could not generate unique slug for: ${base} (${maxAttempts} attempts)`);
}