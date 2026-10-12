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
    text: "Search 12,000+ verified schools with cascading filters: Country → State → City → Locality, board, grade, and type.",
  },
  {
    title: "Compare",
    text: "Evaluate schools side-by-side on fees, facilities, board, extracurriculars, and 5,000+ verified parent ratings.",
  },
  {
    title: "Shortlist & Enquire",
    text: "Save favourites to your personal list. Use one Common Application Form to enquire with multiple schools in a single click.",
  },
  {
    title: "Get Counselled",
    text: "Free one-on-one expert guidance on boards, age criteria, fee structures, deadlines and application strategy — at no cost.",
  },
];

export const whyUsCards = [
  {
    title: "Verified School Profiles",
    text: "Every school profile is verified with updated fees, facilities, curricula, and admission details — no outdated brochures.",
  },
  {
    title: "Transparent Fee Information",
    text: "Full fee breakdown — tuition, boarding, and miscellaneous — so you can plan with complete confidence and no surprises.",
  },
  {
    title: "Compare Schools Side-by-Side",
    text: "Select up to four schools and compare on fees, facilities, board, and 5,000+ verified parent ratings in one view.",
  },
  {
    title: "Free One-on-One Counselling",
    text: "Expert counsellors guide you on CBSE vs IB, age criteria, timelines, and which school fits your child's goals — free, always.",
  },
  {
    title: "Apply to Multiple Schools",
    text: "Fill one Common Application Form once and submit to multiple schools with a single click — saving hours of repetitive paperwork.",
  },
  {
    title: "Pan-India Boarding Coverage",
    text: "From Uttarakhand and Himachal Pradesh to Tamil Nadu and Karnataka — boarding schools across every geography of India.",
  },
];

export const faqItems = [
  {
    question: "Which are the best boarding schools in India?",
    answer:
      "BoardingEdu lists 12,000+ verified schools so you can compare boarding schools in Dehradun, Mussoorie, Bangalore, Pune, Ooty and across India by board, fees, gender and facilities — then shortlist with free counselling.",
  },
  {
    question: "How do I find CBSE, ICSE, IB or IGCSE boarding schools?",
    answer:
      "Use the homepage search: choose Country → State → City → Locality, then select one or more boards (CBSE, ICSE, IB, IGCSE) and school types. Results update from verified school profiles.",
  },
  {
    question: "Can I compare boarding schools and day schools on BoardingEdu?",
    answer:
      "Yes. Add up to four schools and compare fees, board, facilities and parent ratings side-by-side. You can also filter for boarding, day, and day-cum-boarding schools.",
  },
  {
    question: "Is BoardingEdu counselling free for parents?",
    answer:
      "Yes. One-on-one admission counselling is 100% free. Experts help with board differences, age criteria, fee planning, deadlines and a school shortlist that fits your child.",
  },
  {
    question: "Can I apply to multiple schools and for more than one child?",
    answer:
      "Yes. Use one Common Application Form to enquire with multiple schools, and share details for more than one child during free counselling so each sibling gets a tailored shortlist.",
  },
  {
    question: "Where can I find boarding schools in Dehradun, Bangalore or Uttarakhand?",
    answer:
      "Open Explore or Popular School Searches in the footer for SEO landing paths such as boarding schools in Dehradun, Bangalore, Pune, Ooty, Mussoorie and Uttarakhand. Top cities and states also reflect frequently searched school locations.",
  },
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
