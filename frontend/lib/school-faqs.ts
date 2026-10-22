import type { SchoolDetail } from "@/lib/api";
import { schoolTypeLabel } from "@/lib/seo-slugs";

export type SchoolFaq = { question: string; answer: string };

function genderLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "coed" || normalized === "co-ed") return "co-ed";
  if (normalized === "boys" || normalized === "boys only") return "boys";
  if (normalized === "girls" || normalized === "girls only") return "girls";
  return value.toLowerCase();
}

/** Keyword-rich questions built only from published school facts. */
export function schoolProfileFaqs(school: SchoolDetail): SchoolFaq[] {
  const name = school.school_name;
  const city = school.city_detail.city_name;
  const state = school.state_detail.state_name;
  const country = school.country_detail.country_name;
  const locality = school.location_detail?.location_name;
  const place = [locality, city, state].filter(Boolean).join(", ");
  const typeText = school.school_types_detail.length
    ? school.school_types_detail
        .map((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name).toLowerCase())
        .join(" and ")
    : "school";
  const boards = school.boards_detail.map((board) => board.board_name);
  const grades = [...school.grades_offered_detail].sort((left, right) => left.sort_order - right.sort_order);
  const gradeText = grades.length
    ? grades.length === 1
      ? grades[0].grade_name
      : `${grades[0].grade_name} to ${grades[grades.length - 1].grade_name}`
    : null;
  const facilities = school.facilities_detail.map((facility) => facility.facility_name).slice(0, 8);
  const items: SchoolFaq[] = [
    {
      question: `Where is ${name} located?`,
      answer: `${name} is a ${typeText} in ${place}, ${country}. Parents searching for schools in ${city} can review the address, campus details and admission information on this ${name} profile.`,
    },
  ];

  if (boards.length) {
    items.push({
      question: `Which education board does ${name} follow?`,
      answer: `${name} in ${city}, ${state} follows ${boards.join(" and ")}. Use this page to compare ${boards.join(" and ")} ${typeText} options in ${city} alongside fees, grades and facilities.`,
    });
  }

  if (school.school_types_detail.length) {
    items.push({
      question: `Is ${name} a day school or a boarding school?`,
      answer: `${name} is listed as a ${typeText} in ${city}, ${state}. Families comparing day schools and boarding schools in ${city} can use the school type, grades and campus facilities on this profile.`,
    });
  }

  if (gradeText) {
    items.push({
      question: `Which classes does ${name} offer?`,
      answer: `${name} offers ${gradeText} in ${city}, ${state}. Check the admissions section on this ${name} page for the published grades and seat details.`,
    });
  }

  items.push({
    question: `What are the fees at ${name}?`,
    answer: `The fees section of this ${name} profile shows the published fee structure for ${city} when the school has shared it. Confirm the current ${name} fees, payment schedule and admission charges with the school before applying.`,
  });

  if (facilities.length) {
    items.push({
      question: `What facilities does ${name} have?`,
      answer: `Facilities listed for ${name} in ${city} include ${facilities.join(", ")}. Review the campus and infrastructure section for the full ${name} facility list.`,
    });
  }

  if (school.admission_open !== undefined) {
    items.push({
      question: `Are admissions open at ${name}?`,
      answer: school.admission_open
        ? `Admissions are currently marked open at ${name} in ${city}, ${state}. Send an enquiry from this page to confirm seats, grades and the latest ${name} admission dates.`
        : `Admissions are currently marked closed at ${name} in ${city}, ${state}. Send an enquiry from this page to ask when ${name} admissions open again.`,
    });
  }

  if (school.gender) {
    items.push({
      question: `Is ${name} co-ed, boys or girls?`,
      answer: `${name} in ${city} is a ${genderLabel(school.gender)} ${typeText}. The overview on this page also lists the education board, grades and campus details.`,
    });
  }

  if (school.established_year) {
    items.push({
      question: `When was ${name} established?`,
      answer: `${name} was established in ${school.established_year}. It is listed as a ${typeText} in ${place}, ${country}.`,
    });
  }

  items.push({
    question: `How do I contact ${name} for admission?`,
    answer: `Use the enquiry form on this ${name} page to ask about admission in ${city}. The school address is ${[school.address, place, country].filter(Boolean).join(", ")}${school.phone ? `. You can also call ${school.phone}` : ""}.`,
  });

  return items;
}
