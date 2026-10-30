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

export function gradeSortKey(name: string, sortOrder?: number): number {
  if (typeof sortOrder === "number") return sortOrder;
  const label = formatGradeLabel(name).toLowerCase();
  const order = ["pre-nursery", "nursery", "lkg", "ukg"];
  const idx = order.indexOf(label);
  if (idx >= 0) return idx + 1;
  const classMatch = label.match(/class\s+(\d+)/);
  if (classMatch) return 10 + Number(classMatch[1]);
  return 999;
}
