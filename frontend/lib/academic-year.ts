/** Display label for academic year codes (2026-2027 → 2026-27). */
export function formatAcademicYearLabel(code: string | null | undefined): string {
  const raw = (code ?? "").trim();
  if (!raw) return "Academic year";
  const match = raw.match(/^(\d{4})-(\d{4})$/);
  if (match) {
    const start = match[1];
    const endShort = match[2]!.slice(-2);
    return `${start}-${endShort}`;
  }
  return raw.replace(/^Academic Year\s+/i, "").trim() || raw;
}

export function academicYearSortKey(code: string): string {
  const match = code.match(/(\d{4})/);
  return match?.[1] ?? code;
}
