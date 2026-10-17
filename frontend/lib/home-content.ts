export const exploreItems = [
  { emoji: "🏫", title: "Search Boarding Schools", href: "/#schools", query: "boarding" as const },
  { emoji: "☀️", title: "Search Day Schools", href: "/#schools", query: "day" as const },
  { emoji: "⚖️", title: "Compare Schools", href: "/compare", query: null },
  { emoji: "🎓", title: "Free Counseling", href: "/#counselling", query: null },
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
  { emoji: "👨‍👩‍👧‍👦", title: "Applicable to multiple child", href: "/#counselling", query: null },
] as const;

export const howItWorksSteps = [
  {
    title: "Discover",
    text: "Explore school listings by location, education board, school type, and other available details.",
  },
  {
    title: "Compare",
    text: "Compare available school information, including boards, fees, and facilities.",
  },
  {
    title: "Shortlist & Enquire",
    text: "Save schools to compare later or send an enquiry directly to a school.",
  },
  {
    title: "Get Counselled",
    text: "Request counselling for help understanding school options and planning your search.",
  },
];

export const whyUsCards = [
  {
    title: "Verified School Profiles",
    text: "Review the details currently available on each school profile, and contact the school to confirm admissions information.",
  },
  {
    title: "Transparent Fee Information",
    text: "Compare published fee information where available, and ask schools directly about any missing fee details.",
  },
  {
    title: "Compare Schools Side-by-Side",
    text: "Compare selected schools using the profile information available in the directory.",
  },
  {
    title: "Free One-on-One Counselling",
    text: "Request help with school options, education boards, and the next steps in your search.",
  },
  {
    title: "Apply to Multiple Schools",
    text: "Use school enquiry links to contact the schools you are considering.",
  },
  {
    title: "Pan-India Boarding Coverage",
    text: "Browse available school listings by country, state, and city.",
  },
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

export const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "BoardingEdu",
      url: "https://boardingedu.com",
      email: "hello@boardingedu.com",
      telephone: "+91-80-4611-0000",
      description:
        "A school discovery platform helping families explore schools and compare options.",
    },
    {
      "@type": "WebSite",
      name: "BoardingEdu",
      url: "https://boardingedu.com",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://boardingedu.com/?search={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};
