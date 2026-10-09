// lib/school-tabs.ts
import type { SchoolDetail } from '@/types/school';

export type TabKey = 'overview' | 'fees' | 'admission-process' | 'admission-help' | 'reviews';

export interface TabMetaEntry {
  key: TabKey;
  label: string;
  path: string;
  title: (s: SchoolDetail) => string;
  description: (s: SchoolDetail) => string;
}

export const SchoolTabMeta: Record<TabKey, TabMetaEntry> = {
  overview: {
    key: 'overview',
    label: 'Overview',
    path: '',
    title: s => `${s.name}, ${s.city} — Overview, Campus & Info | BoardingEdu`,
    description: s => `Explore ${s.name} overview, campus, facilities, and institutional details.`,
  },
  fees: {
    key: 'fees',
    label: 'Fee Structure',
    path: 'fees',
    title: s => `${s.name} — Fee Structure 2026-27 | BoardingEdu`,
    description: s => `Complete annual fee structure, tuition, and boarding charges for ${s.name}.`,
  },
  'admission-process': {
    key: 'admission-process',
    label: 'Admission Process',
    path: 'admission-process',
    title: s => `${s.name} — Admission Process & Criteria | BoardingEdu`,
    description: s => `Admission criteria, entrance test syllabus, and application process for ${s.name}.`,
  },
  'admission-help': {
    key: 'admission-help',
    label: 'Admission Help',
    path: 'admission-help',
    title: s => `${s.name} — Admission Help & Counselor Support | BoardingEdu`,
    description: s => `Direct counselor support and document help for ${s.name} admissions.`,
  },
  reviews: {
    key: 'reviews',
    label: 'Reviews & Ratings',
    path: 'reviews',
    title: s => `${s.name} — Reviews, Ratings & Alumni Feedback | BoardingEdu`,
    description: s => `Verified parent and student reviews for ${s.name}.`,
  },
};

const ALL_TABS = new Set(Object.keys(SchoolTabMeta));

export function isTabSlug(slug?: string): slug is TabKey {
  return !!slug && ALL_TABS.has(slug);
}

export function normalizeTab(slug?: string): TabKey {
  return isTabSlug(slug) ? slug : 'overview';
}

export function tabToPath(tab: TabKey): string {
  return SchoolTabMeta[tab].path;
}

export function pathToTab(pathname: string): TabKey {
  const parts = pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return isTabSlug(last) ? last : 'overview';
}