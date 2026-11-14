"use client";

import { useMemo, useState } from "react";
import { gradeSortKey } from "@/lib/grade-labels";
import type { BoardListItem } from "@/lib/api";
import SchoolFeeSummary from "./SchoolFeeSummary";

type GradeRow = {
  grade_id: string;
  grade_name: string;
  grade_code?: string;
  sort_order?: number;
};

export default function SchoolFeesAndGrades({
  schoolId,
  grades,
  boards,
  selectedBoardId,
  profilePath,
}: {
  schoolId: string;
  grades: GradeRow[];
  boards: BoardListItem[];
  selectedBoardId?: string;
  profilePath: string;
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
      <article className="detail-panel" id="fees">
        <div className="detail-panel__heading">
          <div>
            <h2>Fees</h2>
          </div>
        </div>
        <SchoolFeeSummary
          schoolId={schoolId}
          grades={sortedGrades.map(({ grade_id, grade_name, grade_code }) => ({
            grade_id,
            grade_name,
            grade_code,
          }))}
          selectedGradeId={selectedGradeId}
          onGradeChange={setSelectedGradeId}
          boards={boards}
          selectedBoardId={selectedBoardId}
          profilePath={profilePath}
        />
      </article>
    </>
  );
}
