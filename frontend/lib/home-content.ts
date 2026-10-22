import {
  faqJsonLd as buildFaqJsonLd,
  organizationJsonLd as buildOrganizationJsonLd,
  websiteJsonLd as buildWebsiteJsonLd,
} from "@/lib/structured-data";

export const exploreItems = [
  { emoji: "🏫", title: "Search Boarding Schools", href: "/#schools", query: "boarding" as const },
  { emoji: "☀️", title: "Search Day Schools", href: "/#schools", query: "day" as const },
  { emoji: "⚖️", title: "Compare Schools", href: "/compare", query: null },
  { emoji: "🎓", title: "Free Counseling", href: "/", query: null, counselling: true },
  { emoji: "🇮🇳", title: "Boarding Schools PAN India", href: "/#schools", query: "india" as const },
  { emoji: "📚", title: "CBSE Boarding Schools", href: "/#schools", query: "cbse" as const },
  { emoji: "🌍", title: "IB Boarding Schools", href: "/#schools", query: "ib" as const },
  { emoji: "📖", title: "ICSE Boarding Schools", href: "/#schools", query: "icse" as const },
  { emoji: "🎩", title: "IGCSE Boarding Schools", href: "/#schools", query: "igcse" as const },
  { emoji: "👩‍🎓", title: "Girls Boarding Schools", href: "/#schools", query: "girls" as const },
  { emoji: "👨‍🎓", title: "Boys Boarding Schools", href: "/#schools", query: "boys" as const },
  { emoji: "🎖️", title: "Military / Sainik Schools", href: "/#schools", query: "sainik" as const },
  { emoji: "⭐", title: "Parent Reviews", href: "/#featured", query: null },
  { emoji: "📝", title: "Apply to Multiple Schools", href: "/signup", query: null },
  { emoji: "👨‍👩‍👧‍👦", title: "Applicable to multiple child", href: "/", query: null, counselling: true },
] as const;

export const howItWorksSteps = [
  { title: "Discover", text: "Open a city, board, or school type." },
  { title: "Compare", text: "Line up fees, boards, and ratings." },
  { title: "Enquire", text: "Contact the schools on your shortlist." },
  { title: "Get guidance", text: "Ask for free admission counselling." },
];

export const whyUsCards = [
  { title: "Verified profiles", text: "Check what the school has published, then confirm with them." },
  { title: "Published fees", text: "Compare the fees that schools have listed." },
  { title: "Side-by-side compare", text: "Review up to four schools in one view." },
  { title: "Free counselling", text: "Request help choosing a board or city." },
  { title: "Direct enquiries", text: "Contact more than one school from its profile." },
  { title: "Places that have schools", text: "City and state links only open listings that exist." },
];

export const faqItems = [
  {
    question: "Which are the best boarding schools in India?",
    answer:
      "The right school depends on your child's needs and your family's priorities. Browse boarding school profiles and compare the available location, board, fee, and facility details.",
  },
  {
    question: "How do I find CBSE, ICSE, IB or IGCSE boarding schools?",
    answer:
      "Browse by education board or use the school directory filters to narrow results by board, location, and school type.",
  },
  {
    question: "Can I compare boarding schools and day schools on BoardingEdu?",
    answer:
      "Yes. Use the comparison feature to review selected schools side-by-side, and filter the directory by Day School, Day Boarding School, or Boarding School.",
  },
  {
    question: "Is BoardingEdu counselling free for parents?",
    answer:
      "Parents can submit the counselling form on this page to request guidance with their school search.",
  },
  {
    question: "Can I apply to multiple schools and for more than one child?",
    answer:
      "You can send enquiries to schools from their profiles. For help with options for more than one child, include that information in your counselling request.",
  },
  {
    question: "Where can I find boarding schools in Dehradun, Bangalore or Uttarakhand?",
    answer:
      "Use the city and state links on this page, or choose a location in the school finder to see available listings for that area.",
  },
];

export const homeSeoKeywords = [
  "schools in India",
  "boarding schools in India",
  "day schools in India",
  "school admissions",
  "CBSE schools",
  "ICSE schools",
  "IB schools",
  "school admission counselling",
];

export const organizationJsonLd = buildOrganizationJsonLd();
export const websiteJsonLd = buildWebsiteJsonLd();
export const faqJsonLd = buildFaqJsonLd(faqItems);

export const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [organizationJsonLd, websiteJsonLd, faqJsonLd],
};
