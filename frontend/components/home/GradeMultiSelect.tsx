"use client";

import type { GradeListItem } from "@/lib/api";

type Props = {
  grades: GradeListItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export default function GradeMultiSelect({
  grades,
  selectedIds,
  onChange,
  disabled = false,
}: Props) {
  const allSelected = grades.length > 0 && selectedIds.length === grades.length;

  return (
    <fieldset className="grade-multi-select" disabled={disabled}>
      <legend>Child&apos;s grade/class *</legend>
      <div className="grade-multi-select__actions">
        <button type="button" onClick={() => onChange(grades.map((grade) => grade.grade_id))}>
          Select all
        </button>
        <button type="button" onClick={() => onChange([])} disabled={!selectedIds.length}>
          Clear all
        </button>
      </div>
      {grades.length ? (
        <div className="grade-multi-select__options">
          {grades.map((grade) => (
            <label key={grade.grade_id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(grade.grade_id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selectedIds, grade.grade_id]
                      : selectedIds.filter((id) => id !== grade.grade_id),
                  )
                }
              />
              <span>{grade.grade_name}</span>
            </label>
          ))}
        </div>
      ) : (
        <p role="status">Grade options are unavailable right now.</p>
      )}
      <span className="grade-multi-select__summary" aria-live="polite">
        {allSelected
          ? `All ${grades.length} grades selected`
          : `${selectedIds.length} grade${selectedIds.length === 1 ? "" : "s"} selected`}
      </span>
    </fieldset>
  );
}
