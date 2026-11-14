export const FEE_STREAMS = [
  { value: "SCIENCE", label: "Science" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "ARTS", label: "Arts" },
] as const;

export type FeeStreamCode = (typeof FEE_STREAMS)[number]["value"];

export function isSeniorSecondaryGrade(grade?: {
  grade_code?: string;
  grade_name?: string;
} | null): boolean {
  if (!grade) return false;
  const label = `${grade.grade_code ?? ""} ${grade.grade_name ?? ""}`.toUpperCase();
  return /(?:^|\D)(11|12)(?=\D|$)/.test(label) || /\b(XI|XII)\b/.test(label);
}

export function feeStreamLabel(stream?: string | null): string {
  return FEE_STREAMS.find((item) => item.value === stream)?.label ?? "";
}
