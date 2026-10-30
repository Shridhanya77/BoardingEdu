"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, LoaderCircle } from "lucide-react";
import { fees, fetchAllPages } from "@/lib/api";
import type { FeeItemListItem, FeeStructureListItem } from "@/lib/api";
import { academicYearSortKey, formatAcademicYearLabel } from "@/lib/academic-year";
import { formatGradeLabel } from "@/lib/grade-labels";

type FeeDetails = {
  structure: FeeStructureListItem;
  items: FeeItemListItem[];
};

type GradeOption = { grade_id: string; grade_name: string };

const frequencyLabels: Record<FeeItemListItem["payment_frequency"], string> = {
  ONE_TIME: "One-time",
  ANNUAL: "Annually",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  TERM: "Term-wise",
  MONTHLY: "Monthly",
  BY_DISTANCE: "By distance",
  DYNAMIC: "Dynamic",
};

function formatAmount(value: string | null) {
  if (value === null) return "Dynamic";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}`
    : value;
}

function pickDefaultYearId(rows: FeeDetails[]): string {
  if (!rows.length) return "";
  const withItems = rows.filter(({ items }) => items.length > 0);
  const pool = withItems.length ? withItems : rows;
  const current = pool.find(
    ({ structure }) =>
      structure.academic_year_code === "2026-2027" ||
      formatAcademicYearLabel(structure.academic_year_code) === "2026-27",
  );
  if (current) return current.structure.academic_year_id;
  const sorted = [...pool].sort(
    (a, b) =>
      academicYearSortKey(b.structure.academic_year_code).localeCompare(
        academicYearSortKey(a.structure.academic_year_code),
      ) || b.items.length - a.items.length,
  );
  return sorted[0]?.structure.academic_year_id ?? "";
}

function yearCodesMatch(candidates: string[], code: string): boolean {
  const label = formatAcademicYearLabel(code);
  return candidates.some(
    (candidate) =>
      code === candidate ||
      formatAcademicYearLabel(candidate) === label ||
      code.includes(candidate) ||
      candidate.includes(code),
  );
}

const PRIMARY_FEE_YEARS = ["2026-2027", "2026-27"];
const FALLBACK_FEE_YEARS = ["2027-2028", "2027-28", "2024-2025", "2024-25"];

export default function SchoolFeeSummary({
  schoolId,
  grades,
  selectedGradeId: controlledGradeId,
  onGradeChange,
}: {
  schoolId: string;
  grades: GradeOption[];
  selectedGradeId?: string;
  onGradeChange?: (gradeId: string) => void;
}) {
  const [details, setDetails] = useState<FeeDetails[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [internalGradeId, setInternalGradeId] = useState("");
  const selectedGradeId = controlledGradeId ?? internalGradeId;
  const setSelectedGradeId = onGradeChange ?? setInternalGradeId;
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fees
      .structuresForSchool(schoolId)
      .then((page) => fetchAllPages(page))
      .then((structures) =>
        Promise.all(
          structures
            .filter((structure) => structure.status && structure.published)
            .map(async (structure) => ({
              structure,
              items: await fetchAllPages(await fees.itemsForStructure(structure.id)),
            })),
        ),
      )
      .then((rows) => {
        if (!cancelled) {
          setDetails(rows);
          setSelectedYearId(pickDefaultYearId(rows));
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Published fee details are unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  useEffect(() => {
    if (controlledGradeId !== undefined) return;
    setInternalGradeId((current) =>
      current && grades.some((grade) => grade.grade_id === current)
        ? current
        : grades[0]?.grade_id ?? "",
    );
  }, [grades, controlledGradeId]);

  useEffect(() => {
    if (controlledGradeId === undefined) return;
    if (controlledGradeId && grades.some((g) => g.grade_id === controlledGradeId)) return;
    if (grades[0]?.grade_id) onGradeChange?.(grades[0].grade_id);
  }, [controlledGradeId, grades, onGradeChange]);

  const availableYears = useMemo(() => {
    const years = new Map<string, string>();
    details.forEach(({ structure }) => {
      years.set(structure.academic_year_id, structure.academic_year_code);
    });
    return [...years.entries()].sort((a, b) =>
      academicYearSortKey(b[1]).localeCompare(academicYearSortKey(a[1])),
    );
  }, [details]);

  const selectedYearCode = availableYears.find(([id]) => id === selectedYearId)?.[1] ?? "";

  const { visibleItems, feeFallbackNote } = useMemo(() => {
    const filterItems = (rows: FeeDetails[]) =>
      rows.flatMap(({ structure, items }) =>
        items
          .filter((item) => !selectedGradeId || !item.grade_id || item.grade_id === selectedGradeId)
          .map((item) => ({ structure, item })),
      );

    const yearDetails = details.filter(
      ({ structure }) => structure.academic_year_id === selectedYearId,
    );
    const items = filterItems(yearDetails);
    if (items.length) {
      return { visibleItems: items, feeFallbackNote: null as string | null };
    }

    if (yearCodesMatch(PRIMARY_FEE_YEARS, selectedYearCode)) {
      for (const fallbackCode of FALLBACK_FEE_YEARS) {
        const fallbackDetails = details.filter(({ structure }) =>
          yearCodesMatch([fallbackCode], structure.academic_year_code),
        );
        const fallbackItems = filterItems(fallbackDetails);
        if (fallbackItems.length) {
          return {
            visibleItems: fallbackItems,
            feeFallbackNote: `2026–27 fees are shown using published ${formatAcademicYearLabel(fallbackCode)} values until the school publishes the current session.`,
          };
        }
      }
    }

    return { visibleItems: items, feeFallbackNote: null };
  }, [details, selectedGradeId, selectedYearCode, selectedYearId]);

  if (loading) {
    return <p className="empty-state" role="status"><LoaderCircle className="spin" size={16} /> Loading published fees…</p>;
  }
  if (error) {
    return <p className="empty-state" role="alert"><AlertCircle size={16} />{error}</p>;
  }
  if (!details.length) {
    return <p className="empty-state"><CheckCircle2 size={16} />No published fee schedule is available yet. Fee details appear here after the school activates and publishes its schedule.</p>;
  }

  const selectedGradeName = formatGradeLabel(
    grades.find((grade) => grade.grade_id === selectedGradeId)?.grade_name ?? "",
  );
  const selectedYearLabel = formatAcademicYearLabel(
    availableYears.find(([id]) => id === selectedYearId)?.[1],
  );

  return (
    <div className="fee-summary">
      <div className="fee-summary__intro">
        <div>
          <h3>Fee Structure</h3>
          <p>Review the published class-wise fees and payment frequency for the selected academic year.</p>
        </div>
        <div className="fee-summary__selectors">
          <label>
            Academic year
            <span className="fee-summary__select-wrap">
              <select value={selectedYearId} onChange={(event) => setSelectedYearId(event.target.value)}>
                {availableYears.map(([id, code]) => (
                  <option key={id} value={id}>{formatAcademicYearLabel(code)}</option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden />
            </span>
          </label>
          <label>
            Grade / class
            <span className="fee-summary__select-wrap">
              <select value={selectedGradeId} onChange={(event) => setSelectedGradeId(event.target.value)}>
                {!grades.length && <option value="">All grades</option>}
                {grades.map((grade) => (
                  <option key={grade.grade_id} value={grade.grade_id}>
                    {formatGradeLabel(grade.grade_name)}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden />
            </span>
          </label>
        </div>
      </div>

      <h4 className="fee-summary__subheading">
        {selectedGradeName || "All grades"} — Academic Year {selectedYearLabel || "2026-27"}
      </h4>
      {feeFallbackNote && <p className="fee-summary__note">{feeFallbackNote}</p>}

      {visibleItems.length ? (
        <div className="fee-summary__table-wrap">
          <table className="fee-summary__table">
            <thead>
              <tr>
                <th scope="col">Fee component</th>
                <th scope="col">Amount</th>
                <th scope="col">Payment frequency</th>
                <th scope="col">Information</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map(({ structure, item }) => {
                const expanded = expandedItems.has(item.id);
                return (
                  <tr key={`${structure.id}-${item.id}`}>
                    <td>
                      <span className="fee-summary__component">{item.item_name}</span>
                      {item.school_type_name && <small>{item.school_type_name}</small>}
                      {expanded && item.description && (
                        <p className="fee-summary__details">{item.description}</p>
                      )}
                      {expanded && (
                        <p className="fee-summary__details">
                          {item.is_refundable ? "Refundable" : "Non-refundable"}
                          {item.tax !== "0.00" ? ` · Tax ${item.tax}%` : ""}
                          {structure.structure_name ? ` · ${structure.structure_name}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="fee-summary__amount">
                      {item.payment_frequency === "DYNAMIC" || item.payment_frequency === "BY_DISTANCE"
                        ? "Dynamic"
                        : formatAmount(item.amount)}
                    </td>
                    <td><span className="fee-summary__frequency">{item.payment_frequency_display || frequencyLabels[item.payment_frequency] || "As published"}</span></td>
                    <td>
                      <button
                        className="fee-summary__details-button"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedItems((current) => {
                          const next = new Set(current);
                          if (expanded) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })}
                      >
                        {expanded ? "Hide details" : "View details"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">No fee items are published for this grade and academic year.</p>
      )}
      <p className="fee-summary__disclaimer">Fees are published by the school and may change. Confirm the current schedule with the school before applying.</p>
    </div>
  );
}
