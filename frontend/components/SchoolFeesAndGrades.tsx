"use client";

import { useMemo, useState } from "react";
import { formatGradeLabel, gradeSortKey } from "@/lib/grade-labels";
import SchoolFeeSummary from "./SchoolFeeSummary";

type GradeRow = {
  grade_id: string;
  grade_name: string;
  sort_order?: number;
};

export default function SchoolFeesAndGrades({
  schoolId,
  grades,
}: {
  schoolId: string;
  grades: GradeRow[];
}) {
  const sortedGrades = useMemo(
    () =>
      [...grades].sort(
        (a, b) =>
          gradeSortKey(a.grade_name, a.sort_order) - gradeSortKey(b.grade_name, b.sort_order),
      ),
    [grades],
  );
  const [selectedGradeId, setSelectedGradeId] = useState(sortedGrades[0]?.grade_id ?? "");

  return (
    <>
      <article className="detail-panel" id="admissions">
        <div className="detail-panel__heading">
          <div>
            <h2>Classes offered</h2>
            <p>
              {sortedGrades.length
                ? `${formatGradeLabel(sortedGrades[0].grade_name)} to ${formatGradeLabel(sortedGrades[sortedGrades.length - 1].grade_name)}. Select a class to see its published fees.`
                : "Select a class to filter fees."}
            </p>
          </div>
        </div>
        {sortedGrades.length === 0 ? (
          <p className="empty-state">Contact the school to confirm which grades they currently offer.</p>
        ) : (
          <div className="grades-picker" role="group" aria-label="Grades offered">
            {sortedGrades.map((grade) => {
              const active = selectedGradeId === grade.grade_id;
              return (
                <button
                  key={grade.grade_id}
                  type="button"
                  className={`grades-picker__chip${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedGradeId(grade.grade_id);
                    document.getElementById("fees")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {formatGradeLabel(grade.grade_name)}
                </button>
              );
            })}
          </div>
        )}
      </article>

      <article className="detail-panel" id="fees">
        <div className="detail-panel__heading">
          <div>
            <h2>Fees</h2>
          </div>
        </div>
        <SchoolFeeSummary
          schoolId={schoolId}
          grades={sortedGrades.map(({ grade_id, grade_name }) => ({ grade_id, grade_name }))}
          selectedGradeId={selectedGradeId}
          onGradeChange={setSelectedGradeId}
        />
      </article>
    </>
  );
}
