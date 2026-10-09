// lib/pseo/city-overrides.ts
import type { ParsedSlug } from './parse-slug';

type Override = {
  title: (type: string, aff?: string) => string;
  description: (type: string, aff?: string) => string;
  keywords: (type: string, aff: string | undefined, city: string) => string[];
};

export const CITY_OVERRIDES: Record<string, Override> = {
  mumbai: {
    title: (t, aff) => `Top & Best ${aff ? aff.toUpperCase() + ' ' : ''}${t} in Mumbai — Admissions & Fees`,
    description: (t, aff) => `Searching for the top ${t} in Mumbai? Verified reviews, fee structures, and admission guidance.`,
    keywords: (t, aff, city) => [
      `best ${t} in ${city}`,
      `top ${t} ${city}`,
      `${aff ? aff + ' ' : ''}${t} ${city}`,
      `${t} ${city} admissions`,
      `${t} ${city} fees`,
      `${city} school admissions 2026`,
    ],
  },
  dehradun: {
    title: (t, aff) => `${aff ? aff.toUpperCase() + ' ' : ''}${t} in Dehradun — India's Boarding Capital`,
    description: (t) => `Dehradun is India's boarding school capital. Browse the top ${t} with fees and admission details.`,
    keywords: (t, aff, city) => [
      `${t} ${city}`,
      `best boarding schools ${city}`,
      `${city} boarding school fees`,
      `${aff ? aff + ' ' : ''}boarding schools ${city}`,
      `top schools ${city} 2026`,
    ],
  },
  // ...18 more high-intent cities
};