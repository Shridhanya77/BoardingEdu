// lib/pseo/metadata.ts
import type { Metadata } from 'next';
import type { ParsedSlug } from './parse-slug';
import { resolveTitle, resolveDescription } from './city-overrides';
import { generateKeywords } from './keywords';
import { buildCanonical } from './meili-filter';

export function generatePseoMetadata(p: ParsedSlug): Metadata {
  return {
    title: resolveTitle(p),
    description: resolveDescription(p),
    keywords: generateKeywords(p),         // ← v1.1 addition
    alternates: { canonical: buildCanonical(p) },
    openGraph: {
      title: resolveTitle(p),
      description: resolveDescription(p),
      url: buildCanonical(p),
    },
  };
}