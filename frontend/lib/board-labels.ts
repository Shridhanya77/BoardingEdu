const BOARD_LABELS: Record<string, string> = {
  CBSE: "CBSE",
  ICSE: "ICSE",
  CISCE: "ICSE",
  IB: "IB",
  IGCSE: "IGCSE",
  CAMBRIDGE: "Cambridge",
  NIOS: "NIOS",
  STATE: "State Board",
  FINLAND: "Finland",
};

export function boardLabel(board: {
  board_code?: string | null;
  board_name?: string | null;
  slug?: string | null;
}): string {
  const code = (board.board_code || "").toUpperCase();
  if (code && BOARD_LABELS[code]) return BOARD_LABELS[code];
  const name = (board.board_name || "").trim();
  if (name && BOARD_LABELS[name.toUpperCase()]) return BOARD_LABELS[name.toUpperCase()];
  const slug = (board.slug || "").toUpperCase();
  if (slug && BOARD_LABELS[slug]) return BOARD_LABELS[slug];
  return name || code || "Board";
}

export function boardsAffiliatedLabel(
  boards: { board_code?: string | null; board_name?: string | null; slug?: string | null }[],
): string {
  const unique = [...new Set(boards.map(boardLabel).filter(Boolean))];
  return unique.join(", ");
}
