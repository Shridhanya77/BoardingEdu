"use client";

import { useMemo, useState } from "react";
import { gradeSortKey } from "@/lib/grade-labels";
import type { BoardListItem } from "@/lib/api";
import SchoolFeeSummary from "./SchoolFeeSummary";

type GradeRow = {
  grade_id: string;
  grade_name: string;
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
  const selectedBoard = boards.find((board) => board.board_id === selectedBoardId);

  return (
    <>
      <article className="detail-panel" id="fees">
        <div className="detail-panel__heading">
          <div>
            <h2>Fees</h2>
          </div>
        </div>
        {boards.length > 1 && (
          <form className="school-board-picker" action={profilePath} method="get">
            <label htmlFor="school-board-selection">
              This school offers multiple boards. Choose one to view board-specific context.
            </label>
            <div className="school-board-picker__controls">
              <select
                id="school-board-selection"
                name="board"
                defaultValue={selectedBoard?.board_id ?? ""}
                required
              >
                <option value="" disabled>Select a board</option>
                {boards.map((board) => (
                  <option key={board.board_id} value={board.board_id}>{board.board_name}</option>
                ))}
              </select>
              <button type="submit">{selectedBoard ? "Update board" : "Show information"}</button>
            </div>
            <p>
              Selection updates board-related FAQs and school suggestions. Fees, grades, and facilities are shared school information.
            </p>
          </form>
        )}
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
