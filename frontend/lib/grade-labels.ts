/** Normalize grade labels for display (LKG/UKG, Class N, Pre-Nursery). */
export function formatGradeLabel(name: string): string {
  const raw = (name || "").trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  if (lower.includes("lower kindergarten") || lower === "lk") return "LKG";
  if (lower.includes("upper kindergarten") || lower === "uk") return "UKG";
  if (lower.includes("pre-nursery") || lower.includes("prenursery") || lower === "pn") return "Pre-Nursery";
  if (lower === "nursery" || lower === "nur") return "Nursery";
  if (/^grade\s+(\d+)/i.test(raw)) {
    return raw.replace(/^grade\s+/i, "Class ");
  }
  if (/^class\s+(\d+)/i.test(raw)) return raw;
  if (/^g(\d{1,2})$/i.test(raw)) return `Class ${raw.slice(1)}`;
  return raw;
}

type GradeOption = {
  grade_id: string;
  grade_code?: string;
  grade_name: string;
  sort_order?: number;
};

function isPreNursery(grade: GradeOption) {
  const code = (grade.grade_code ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const name = grade.grade_name.toLowerCase().replace(/[^a-z]/g, "");
  return ["PN", "PRENUR", "PRENURSERY"].includes(code) ||
    name.includes("prenursery") ||
    name === "pn";
}

function isNursery(grade: GradeOption) {
  const code = (grade.grade_code ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const name = grade.grade_name.toLowerCase().replace(/[^a-z]/g, "");
  return ["NUR", "NURSERY"].includes(code) || name === "nursery" || name === "nur";
}

export function gradeSelectOptions<T extends GradeOption>(grades: T[]): T[] {
  const sorted = [...grades].sort(
    (left, right) =>
      gradeSortKey(left.grade_name, left.sort_order, left.grade_code) -
      gradeSortKey(right.grade_name, right.sort_order, right.grade_code),
  );
  const preNursery = sorted.find(isPreNursery);
  const nursery = sorted.find(isNursery);
  const combinedGrade = preNursery ?? nursery;
  const otherGrades = sorted
    .filter((grade) => !isPreNursery(grade) && !isNursery(grade))
    .map((grade) => ({
      ...grade,
      grade_name: gradeSelectLabel(grade.grade_name),
    }));

  return [
    ...(combinedGrade
      ? [{ ...combinedGrade, grade_name: "Pre-Nursery/Nursery" }]
      : []),
    ...otherGrades,
  ];
}

export function gradeSelectLabel(name: string): string {
  const raw = name.trim();
  if (/^(class|grade)\s+\d+$/i.test(raw)) {
    return `Grade ${raw.match(/\d+/)?.[0] ?? ""}`;
  }
  if (/^g\d{1,2}$/i.test(raw)) return `Grade ${raw.slice(1)}`;
  if (/lower kindergarten/i.test(raw) || /^(lk|lkg)$/i.test(raw)) return "LKG";
  if (/upper kindergarten/i.test(raw) || /^(uk|ukg)$/i.test(raw)) return "UKG";
  return formatGradeLabel(raw);
}

export function gradeSortKey(name: string, sortOrder?: number, code?: string): number {
  const token = (code || "").toUpperCase();
  if (token === "PN" || token === "PRENUR") return 0;
  if (token === "NUR" || token === "NURSERY") return 1;
  if (token === "LKG") return 2;
  if (token === "UKG") return 3;
  if (/^G\d{1,2}$/.test(token)) return 10 + Number(token.slice(1));
  const label = formatGradeLabel(name).toLowerCase();
  const order = ["pre-nursery", "nursery", "lkg", "ukg"];
  const idx = order.indexOf(label);
  if (idx >= 0) return idx;
  const classMatch = label.match(/class\s+(\d+)/);
  if (classMatch) return 10 + Number(classMatch[1]);
  if (typeof sortOrder === "number") return 100 + sortOrder;
  return 999;
}

export function formatGradesRange(
  grades: { grade_name: string; grade_code?: string; sort_order?: number }[],
): string | null {
  if (!grades.length) return null;
  const sorted = [...grades].sort(
    (a, b) => gradeSortKey(a.grade_name, a.sort_order, a.grade_code) - gradeSortKey(b.grade_name, b.sort_order, b.grade_code),
  );
  const start = formatGradeLabel(sorted[0].grade_name);
  const end = formatGradeLabel(sorted[sorted.length - 1].grade_name);
  return start === end ? start : `${start} – ${end}`;
}
