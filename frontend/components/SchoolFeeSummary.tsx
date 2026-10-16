"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, LoaderCircle } from "lucide-react";
import { fees, fetchAllPages } from "@/lib/api";
import type { FeeItemListItem, FeeStructureListItem } from "@/lib/api";

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

function formatAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}`
    : value;
}

export default function SchoolFeeSummary({
  schoolId,
  grades,
}: {
  schoolId: string;
  grades: GradeOption[];
}) {
  const [details, setDetails] = useState<FeeDetails[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState("");
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
          setSelectedYearId(
            rows
              .slice()
              .sort((a, b) => b.structure.effective_from.localeCompare(a.structure.effective_from))[0]
              ?.structure.academic_year_id ?? "",
          );
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
    setSelectedGradeId((current) =>
      current && grades.some((grade) => grade.grade_id === current)
        ? current
        : grades[0]?.grade_id ?? "",
    );
  }, [grades]);

  const availableYears = useMemo(() => {
    const years = new Map<string, string>();
    details.forEach(({ structure }) => {
      years.set(structure.academic_year_id, structure.academic_year_code);
    });
    return [...years.entries()].sort((a, b) => b[1].localeCompare(a[1]));
  }, [details]);

  const yearDetails = details.filter(
    ({ structure }) => structure.academic_year_id === selectedYearId,
  );
  const visibleItems = yearDetails.flatMap(({ structure, items }) =>
    items
      .filter((item) => !selectedGradeId || !item.grade_id || item.grade_id === selectedGradeId)
      .map((item) => ({ structure, item })),
  );

  if (loading) {
    return <p className="empty-state" role="status"><LoaderCircle className="spin" size={16} /> Loading published fees…</p>;
  }
  if (error) {
    return <p className="empty-state" role="alert"><AlertCircle size={16} />{error}</p>;
  }
  if (!details.length) {
    return <p className="empty-state"><CheckCircle2 size={16} />No published fee details are currently available. Please send an enquiry to request the latest fee schedule.</p>;
  }

  const selectedGradeName = grades.find((grade) => grade.grade_id === selectedGradeId)?.grade_name;

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
                {availableYears.map(([id, code]) => <option key={id} value={id}>{code}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden />
            </span>
          </label>
          <label>
            Grade / class
            <span className="fee-summary__select-wrap">
              <select value={selectedGradeId} onChange={(event) => setSelectedGradeId(event.target.value)}>
                {!grades.length && <option value="">All grades</option>}
                {grades.map((grade) => <option key={grade.grade_id} value={grade.grade_id}>{grade.grade_name}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden />
            </span>
          </label>
        </div>
      </div>

      <h4 className="fee-summary__subheading">
        {selectedGradeName || "All grades"} — Academic Year {availableYears.find(([id]) => id === selectedYearId)?.[1]}
      </h4>

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
                      {expanded && (
                        <p className="fee-summary__details">
                          {item.is_refundable ? "Refundable" : "Non-refundable"}
                          {item.tax !== "0.00" ? ` · Tax ${item.tax}%` : ""}
                          {structure.structure_name ? ` · ${structure.structure_name}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="fee-summary__amount">{formatAmount(item.amount)}</td>
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
