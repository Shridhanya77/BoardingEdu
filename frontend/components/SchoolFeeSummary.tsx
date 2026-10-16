"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { fees, fetchAllPages } from "@/lib/api";
import type { FeeItemListItem, FeeStructureListItem } from "@/lib/api";

type FeeDetails = {
  structure: FeeStructureListItem;
  items: FeeItemListItem[];
};

function formatAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}`
    : value;
}

export default function SchoolFeeSummary({ schoolId }: { schoolId: string }) {
  const [details, setDetails] = useState<FeeDetails[]>([]);
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

  if (loading) {
    return <p className="empty-state" role="status"><LoaderCircle className="spin" size={16} /> Loading published fees…</p>;
  }
  if (error) {
    return <p className="empty-state" role="alert"><AlertCircle size={16} />{error}</p>;
  }
  if (!details.length) {
    return <p className="empty-state"><CheckCircle2 size={16} />No published fee details are currently available. Please send an enquiry to request the latest fee schedule.</p>;
  }

  return (
    <div className="fee-summary__structures">
      {details.map(({ structure, items }) => (
        <section className="fee-summary__structure" key={structure.id}>
          <h3>{structure.structure_name}</h3>
          <p>
            {structure.academic_year_code}
            {structure.payment_terms_name ? ` · ${structure.payment_terms_name}` : ""}
          </p>
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.item_name}
                    {item.grade_name ? ` · ${item.grade_name}` : ""}
                    {item.school_type_name ? ` · ${item.school_type_name}` : ""}
                  </span>
                  <strong>{formatAmount(item.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No fee items have been published for this fee structure.</p>
          )}
        </section>
      ))}
    </div>
  );
}
