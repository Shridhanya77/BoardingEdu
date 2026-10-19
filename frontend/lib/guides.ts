export type GuideCategory =
  | "Admissions"
  | "Boarding Life"
  | "Boards & Curriculum"
  | "Fees & Planning";

export type GuideSection = {
  heading: string;
  body: string[];
};

export type GuideArticle = {
  slug: string;
  title: string;
  summary: string;
  /** ISO date string (YYYY-MM-DD). */
  updated: string;
  readingMinutes: number;
  category: GuideCategory;
  sections: GuideSection[];
};

export type GuideSummary = Omit<GuideArticle, "sections">;

export const guidesIndexDescription =
  "Practical, jargon-free guides to Indian school admissions — how to shortlist schools, what to ask on a visit, how the boards differ, and how to plan the transition to boarding life.";

export const guides: GuideArticle[] = [
  {
    slug: "how-to-shortlist-boarding-schools",
    title: "How to Shortlist Boarding Schools for Your Child",
    summary:
      "A practical, step-by-step approach to turning a long list of boarding schools into a shortlist that genuinely matches your child, your budget and your family's priorities.",
    updated: "2026-09-22",
    readingMinutes: 8,
    category: "Admissions",
    sections: [
      {
        heading: "Start with your child, not the school",
        body: [
          "The strongest shortlists begin with an honest look at the child who will actually be living there. Think about their temperament, how independently they cope with routines, how they respond to new people, and what they genuinely enjoy. A school that suits an outgoing, sporty teenager may be a poor fit for a quiet child who needs a small, calm environment.",
          "Write down what you have noticed at home and at their current school. If your child already has a learning support plan or a particular strength, note it, because it will help you ask better questions later. This first step costs nothing and prevents you from being swayed by a glossy prospectus.",
        ],
      },
      {
        heading: "Decide your non-negotiables",
        body: [
          "Before you browse any directory, agree on the handful of factors you will not compromise on. Common ones include distance from home, whether you want full boarding or weekly boarding, the curriculum (for example a national board or an international one), day versus residential, and single-sex versus co-educational.",
          "Keep this list short — three to five items. If everything is a non-negotiable, nothing is, and you will end up comparing schools on details that do not matter to your family.",
        ],
      },
      {
        heading: "Build a long list, then filter it down",
        body: [
          "Use a directory to gather a broad set of candidates that meet your non-negotiables. Ask other parents for word-of-mouth suggestions, and pay attention to how quickly and clearly each school communicates when you enquire. The first email or phone call is often a preview of everything that follows.",
          "Check that the school is affiliated to a recognised board and licensed to operate as a residential school. Basic diligence — a working website, a reachable admissions office, and a clear address — filters out a surprising amount of noise before you spend time on visits.",
        ],
      },
      {
        heading: "Compare on evidence, not marketing",
        body: [
          "Prospectuses are designed to impress, so make your comparisons on things you can verify. Tour the campus on a normal working day, ask to see a typical timetable, and look at how staff speak to students when they think no one is watching. Consistent answers across your visits and your reading build confidence; contradictions are a warning sign.",
          "Do not rely on any single number you cannot confirm. Where a school makes a claim, ask how it is measured and ask to see the underlying detail.",
        ],
      },
      {
        heading: "Use a simple decision scorecard",
        body: [
          "Once you have visited a few schools, score each one against the criteria that matter most to you, giving more weight to your non-negotiables. Keep the notes and photos from each visit together so that the schools do not blur into one another after a couple of weeks.",
          "Aim for a working shortlist of four to six schools. That is small enough to research properly and large enough that you are not forced into a single option if one waits list or application does not work out.",
        ],
      },
      {
        heading: "Treat the shortlist as a living document",
        body: [
          "After each visit, revisit your notes and adjust the ranking. A school that looked ideal on paper may move up or down once you have walked its corridors. The goal is not a perfect decision on day one, but a decision you can explain and stand behind when you finally apply.",
        ],
      },
    ],
  },
  {
    slug: "questions-to-ask-on-a-school-visit",
    title: "Questions to Ask on a School Visit",
    summary:
      "The prompts and observations that reveal how a school actually runs day to day, well beyond the scripted guided tour.",
    updated: "2026-09-18",
    readingMinutes: 7,
    category: "Admissions",
    sections: [
      {
        heading: "Prepare before you go",
        body: [
          "A school visit moves quickly, so arrive with a written list of questions rather than trying to remember them on the spot. Where possible, ask to see a normal working day rather than a specially arranged showcase, because the everyday rhythm is what your child will live inside.",
          "Bring your child if the school allows it. The way they react to a classroom, a dormitory and a few other students often tells you more than a brochure ever will.",
        ],
      },
      {
        heading: "Academics and teaching",
        body: [
          "Ask how class sizes are decided, how student progress is tracked through the year, and what happens when a child is falling behind or racing ahead. Good schools have a clear answer for both ends of the range, not just for the average student.",
          "It is also fair to ask how teachers are supported and trained, and how often the school reviews its own results and adjusts its approach.",
        ],
      },
      {
        heading: "Boarding and pastoral care",
        body: [
          "For a boarding school, the residential side deserves as much attention as the classrooms. Ask how boarding houses are organised, who is on duty overnight, how medical care works, and how the school stays in touch with parents. Ask specifically how it handles homesickness and the first few difficult weeks.",
          "Clarify the rules around phones, internet use and weekend leave, and ask how those rules are explained to students rather than simply enforced.",
        ],
      },
      {
        heading: "Staff culture and behaviour",
        body: [
          "Ask how long senior staff have been at the school and how it handles bullying, conflict and discipline. A confident school will describe a clear, written process; a vague answer is worth noting.",
          "Watch how students behave when the guide stops talking. Do they look relaxed and well-supervised, or tense and overly silent? Listen to how staff address children and how children address staff.",
        ],
      },
      {
        heading: "Facilities and daily practicalities",
        body: [
          "Look at the things students use every day: dormitories, washrooms, the dining hall, drinking water, sports and study spaces. Ask about the food menu, laundry, transport for weekends and the routine on a full boarding week.",
          "Safety matters as much as comfort. Ask about campus security, visitor protocols and emergency procedures, and see whether the answers match what you can observe.",
        ],
      },
      {
        heading: "Trust what you observed",
        body: [
          "At the end of the visit, trust your own eyes. If the tour felt warm, organised and honest, and your child seemed at ease, that is meaningful evidence. If something felt off but you cannot quite name it, write it down and compare it with your next visit before moving on.",
        ],
      },
    ],
  },
  {
    slug: "boarding-school-vs-day-boarding",
    title: "Boarding School vs Day Boarding: Which Suits Your Family?",
    summary:
      "How full boarding and day boarding differ in routine, cost, independence and family life — and a practical way to decide between them.",
    updated: "2026-09-12",
    readingMinutes: 6,
    category: "Boarding Life",
    sections: [
      {
        heading: "What each model actually means",
        body: [
          "Full boarding means the child lives at school through the term, with meals, study and activities all happening on campus. Day boarding — sometimes called extended day — keeps the same early start and long day but the child returns home each evening. Weekly boarding sits in between, with students going home at weekends.",
          "The labels can be used loosely, so always confirm the actual daily and weekly routine rather than relying on the name.",
        ],
      },
      {
        heading: "Routine and independence",
        body: [
          "Boarding builds self-management quickly: children learn to organise their own mornings, belongings and study time with support from house staff. That independence is one of its strongest arguments, but it also means less day-to-day contact with family during term time.",
          "Day boarding keeps the family involved every evening while still giving a structured, supervised day. For some children this is the better balance; for others, the full immersion of boarding is what helps them thrive.",
        ],
      },
      {
        heading: "Cost and logistics",
        body: [
          "Full boarding generally costs more than day schooling because lodging, meals and round-the-clock care are included in the arrangement. Against that, families often save on daily commuting, separate tuition or supervision, and the coordination of multiple after-school activities.",
          "Day boarding usually sits between a standard day school and full boarding in cost. Compare the complete picture — including extras, travel and any activity fees — rather than only the headline number.",
        ],
      },
      {
        heading: "Social and emotional considerations",
        body: [
          "Think about how your child handles separation, change and shared living. Some children are ready far earlier than parents expect; others need more time and reassurance. Sibling dynamics matter too, because siblings can flourish or struggle under the same arrangement.",
          "A short, honest conversation with your child — and with their current teachers if you can — will tell you more about readiness than any general rule.",
        ],
      },
      {
        heading: "How to decide",
        body: [
          "Weigh the child's temperament, your family circumstances and what each model realistically asks of everyone. If daily family contact is central to how your child copes, day boarding may be the fit. If independence, routine and a strong peer community are the priority, full boarding may suit better.",
          "There is no universal right answer. The right choice is the one that matches your specific child and your specific family, and it is worth revisiting as your child grows.",
        ],
      },
      {
        heading: "A middle path worth considering",
        body: [
          "If the family is unsure, weekly boarding or a trial of short residential programmes can be a gentle way to test how a child responds to living away from home before committing to a longer arrangement.",
        ],
      },
    ],
  },
  {
    slug: "cbse-icse-ib-igcse-explained",
    title: "CBSE, ICSE, IB and IGCSE Explained",
    summary:
      "A plain-language overview of the main school boards and curricula available in India, and what each one tends to emphasise.",
    updated: "2026-09-05",
    readingMinutes: 8,
    category: "Boards & Curriculum",
    sections: [
      {
        heading: "Start with what a board actually is",
        body: [
          "A board is the body that sets the curriculum, conducts assessments and awards the final certificate for a stage of schooling. Schools affiliate to a board, which is why two schools can feel very different even when they belong to the same one.",
          "Understanding the broad character of each board helps you ask better questions, but the day-to-day quality of teaching, staff and leadership usually matters more than the label alone.",
        ],
      },
      {
        heading: "CBSE",
        body: [
          "The Central Board of Secondary Education is a national board with a structured, standardised syllabus that is widely available across India. Because it is so common, it tends to make transitions between cities and states more straightforward for families who move.",
          "Its structure is often valued by families who want a familiar, consistent academic path and clear alignment with mainstream Indian higher-education entrance preparation.",
        ],
      },
      {
        heading: "ICSE and ISC (CISCE)",
        body: [
          "The Council for the Indian School Certificate Examinations offers ICSE at the school level and ISC at the senior level. It is known for subject breadth and a strong emphasis on English, detailed study and project work.",
          "Families often choose it when they want a wide academic base and a comparable national qualification with a somewhat different flavour from CBSE.",
        ],
      },
      {
        heading: "IB (International Baccalaureate)",
        body: [
          "The IB is an international framework running through the primary, middle and diploma years. It is enquiry-based, encourages independent research and writing, and places weight on broader skills as well as examinations, particularly in the diploma stage.",
          "It is often chosen by globally mobile families or those considering higher education abroad, though its demands and structure suit some students more than others.",
        ],
      },
      {
        heading: "IGCSE and Cambridge",
        body: [
          "Cambridge qualifications, including IGCSE and later A Levels, are international and exam-focused, with a wide range of subject choices and flexibility in how students combine them.",
          "They are popular among families who want an internationally recognised qualification and the option to specialise in subjects their child is strongest in.",
        ],
      },
      {
        heading: "State boards",
        body: [
          "State boards follow regional curricula, often with a strong emphasis on the local language and content tied to the state's own context. They can be a good fit for families who plan to continue within the same state system.",
          "Availability, language and higher-education plans usually drive this choice more than any abstract ranking.",
        ],
      },
      {
        heading: "How to choose",
        body: [
          "There is no universally best board. The right one depends on your child's learning style, your family's mobility, your higher-education plans and what is actually available near you. Use the overview above to ask sharper questions, then judge each school on how well it teaches, not only on the certificate it issues.",
        ],
      },
    ],
  },
  {
    slug: "admission-documents-and-planning",
    title: "Admission Documents, Timelines and Budget Planning",
    summary:
      "A checklist of the paperwork schools commonly ask for, how to build an admissions calendar, and how to plan the cost picture sensibly.",
    updated: "2026-08-28",
    readingMinutes: 7,
    category: "Fees & Planning",
    sections: [
      {
        heading: "Put the paperwork together early",
        body: [
          "Most schools ask for a similar core set of documents, so gathering them once saves repeated stress later. Typical items include the child's birth certificate, identity and address proof for parents, previous school reports or mark sheets, a transfer certificate, recent photographs, immunisation and medical records, and sometimes a passport.",
          "Requirements vary between schools, so confirm the exact list with each admissions office. Keep scanned copies of everything in a safe folder and carry a set of physical copies to every visit.",
        ],
      },
      {
        heading: "Build an admissions calendar",
        body: [
          "Admissions run on their own rhythm, and different schools open enquiries at different times. Mark the enquiry windows, application deadlines, assessment or interview dates, result announcements and acceptance deadlines for every school on your shortlist in one place.",
          "Work backwards from the earliest deadline so that forms, documents and visits are not squeezed into a single week. A simple shared calendar or tracker keeps the whole family on the same page.",
        ],
      },
      {
        heading: "Understand the full cost picture",
        body: [
          "Fees vary enormously between schools, so the useful step is not to compare against a national average but to understand each school's complete schedule. Ask for the published fee structure in writing and look beyond tuition to include lodging, meals, one-time admission or registration charges, refundable deposits, and extras such as uniforms, books, technology and activities.",
          "For boarding, the residential charges are a large part of the total, so make sure you understand exactly what they cover and what is billed separately.",
        ],
      },
      {
        heading: "Ask about fee policies",
        body: [
          "Clarify how fees are paid through the year, what the policy is on annual increases, and how refunds work if plans change. If a school offers scholarships or concessions, ask about eligibility and the application process, and record the details in your notes.",
          "Getting these answers in writing before you commit prevents surprises later.",
        ],
      },
      {
        heading: "Keep a simple tracker",
        body: [
          "As the number of schools grows, a basic spreadsheet — one row per school with columns for deadlines, documents, fees and status — does most of the work. It turns a stressful process into a routine one and makes sure nothing quietly slips through.",
        ],
      },
    ],
  },
  {
    slug: "preparing-your-child-for-boarding",
    title: "Preparing Your Child for the Transition to Boarding",
    summary:
      "Practical ways to help your child feel ready and confident before they move to boarding, and to stay connected once they do.",
    updated: "2026-08-20",
    readingMinutes: 6,
    category: "Boarding Life",
    sections: [
      {
        heading: "Talk about it early and openly",
        body: [
          "Introduce the idea well before the move so it does not come as a shock. Frame it positively — as a new chapter with new friends and opportunities — while acknowledging that feeling nervous is completely normal and allowed.",
          "Invite questions and answer them honestly, including the ones about missing home. Children cope better with a change they helped think through than one that simply happened to them.",
        ],
      },
      {
        heading: "Build everyday independence skills",
        body: [
          "Boarding rewards children who can manage small daily tasks themselves. Before the move, practise getting up to an alarm, organising belongings, keeping track of money, doing laundry and tidying a shared space.",
          "Start small and let your child take the lead where they can. These skills quietly reduce the number of things they have to learn all at once in the first weeks.",
        ],
      },
      {
        heading: "Visit and rehearse",
        body: [
          "Attend any orientation or induction the school offers, and if you can, meet the house staff and a few future classmates in advance. Walk the route to the dormitory, the dining hall and the classrooms so the campus feels familiar on day one.",
          "Talking through a typical day in advance — when they wake, when they eat, when they can call home — turns the unknown into something concrete.",
        ],
      },
      {
        heading: "Set up how you will stay in touch",
        body: [
          "Agree on a realistic rhythm for calls and messages that fits the school's rules, and stick to it so your child knows when to expect you. Small, reliable contact is often more reassuring than constant, unpredictable checking in.",
          "Letters and care packages can mean a great deal in the first term, when a quiet reminder of home helps bridge the gap.",
        ],
      },
      {
        heading: "Expect an adjustment period",
        body: [
          "Almost every child takes time to settle, and a spell of homesickness in the early weeks is normal rather than a sign that the decision was wrong. Keep the school informed about how your child is doing and lean on the house staff, who see this every year.",
          "Stay in touch with teachers and pastoral staff, attend parents' meetings and events, and give the routine a fair chance to settle before drawing conclusions.",
        ],
      },
      {
        heading: "Stay involved from a distance",
        body: [
          "Being involved does not require being on campus. Follow progress reports, respond to the school's updates, and show interest in the new friendships and activities your child is discovering. Your steady engagement is often what makes the transition feel safe.",
        ],
      },
    ],
  },
];

function toSummary(guide: GuideArticle): GuideSummary {
  return {
    slug: guide.slug,
    title: guide.title,
    summary: guide.summary,
    updated: guide.updated,
    readingMinutes: guide.readingMinutes,
    category: guide.category,
  };
}

export function guideList(): GuideSummary[] {
  return guides.map(toSummary);
}

export function getGuide(slug: string): GuideArticle | undefined {
  return guides.find((guide) => guide.slug === slug);
}

export function relatedGuides(slug: string, limit = 3): GuideSummary[] {
  const current = getGuide(slug);
  if (!current) return [];

  const ranked = guides
    .filter((guide) => guide.slug !== slug)
    .sort((a, b) => {
      const aRank = a.category === current.category ? 0 : 1;
      const bRank = b.category === current.category ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return a.title.localeCompare(b.title);
    });

  return ranked.slice(0, limit).map(toSummary);
}
