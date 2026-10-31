"""Display helpers for class labels and board names on public school pages."""

from __future__ import annotations

import re

CODE_ORDER = {
    "PN": 0,
    "PRENUR": 0,
    "PRE-NURSERY": 0,
    "NUR": 1,
    "NURSERY": 1,
    "LKG": 2,
    "UKG": 3,
}

BOARD_LABELS = {
    "CBSE": "CBSE",
    "ICSE": "ICSE",
    "CISCE": "ICSE",
    "IB": "IB",
    "IGCSE": "IGCSE",
    "CAMBRIDGE": "Cambridge",
    "NIOS": "NIOS",
    "STATE": "State Board",
    "FINLAND": "Finland",
}


def format_grade_label(name: str, code: str = "") -> str:
    raw = (name or "").strip()
    token = (code or raw).strip().upper()
    if token in {"PN", "PRENUR", "PRE-NURSERY"} or "pre-nursery" in raw.lower() or "prenursery" in raw.lower():
        return "Pre-Nursery"
    if token in {"NUR", "NURSERY"} or raw.lower() == "nursery":
        return "Nursery"
    if token == "LKG" or "lower kindergarten" in raw.lower():
        return "LKG"
    if token == "UKG" or "upper kindergarten" in raw.lower():
        return "UKG"
    if token.startswith("G") and token[1:].isdigit():
        return f"Class {int(token[1:])}"
    match = re.search(r"(?:grade|class|g)\s*(\d{1,2})", raw, re.I)
    if match:
        return f"Class {int(match.group(1))}"
    return raw


def grade_sort_value(grade) -> tuple[int, str]:
    code = (getattr(grade, "grade_code", "") or "").upper()
    name = getattr(grade, "grade_name", "") or ""
    if code in CODE_ORDER:
        return (CODE_ORDER[code], name)
    if code.startswith("G") and code[1:].isdigit():
        return (10 + int(code[1:]), name)
    label = format_grade_label(name, code).lower()
    named = {"pre-nursery": 0, "nursery": 1, "lkg": 2, "ukg": 3}
    if label in named:
        return (named[label], name)
    match = re.search(r"class\s+(\d+)", label)
    if match:
        return (10 + int(match.group(1)), name)
    return (1000 + int(getattr(grade, "sort_order", 0) or 0), name)


def board_label(board) -> str:
    code = (getattr(board, "board_code", "") or "").upper()
    if code in BOARD_LABELS:
        return BOARD_LABELS[code]
    name = (getattr(board, "board_name", "") or "").strip()
    return BOARD_LABELS.get(name.upper(), name or code)
