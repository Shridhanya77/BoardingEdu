"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, GraduationCap, Star } from "lucide-react";
import { apiErrorMessage, dashboards } from "@/lib/api";
import {
  DashboardPanel,
  DashboardShell,
  DashboardState,
  EmptyTableRow,
  StatCard,
  useDashboardData,
} from "@/components/dashboard/DashboardShell";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  CALL_BACK: "Callback scheduled",
  CONVERTED: "Converted",
  CLOSED_LOST: "Closed",
  SPAM: "Spam",
};

export default function ParentDashboardPage() {
  const { data, loading, error, reload } = useDashboardData(dashboards.parent);
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function removeSchool(schoolId: string) {
    setRemoveError(null);
    try {
      await dashboards.removeShortlist(schoolId);
      setRemoved((current) => ({ ...current, [schoolId]: true }));
    } catch (reason) {
      setRemoveError(apiErrorMessage(reason));
    }
  }

  return (
    <DashboardShell
      roles={["PARENT"]}
      eyebrow="PARENT DASHBOARD"
      title="Your school search, all in one place"
      subtitle="Track the schools you contacted and the enquiries you sent."
    >
      <DashboardState loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          <div className="dash-stats">
            <StatCard label="Enquiries sent" value={data.stats.enquiries_total} accent="blue" />
            <StatCard
              label="Open enquiries"
              value={data.stats.enquiries_open}
              hint="Still being processed"
              accent="orange"
            />
            <StatCard label="Children added" value={data.stats.children} />
            <StatCard label="Shortlisted schools" value={data.stats.shortlisted} accent="green" />
            <StatCard
              label="Reviews written"
              value={data.stats.reviews_total}
              hint={`${data.stats.reviews_published} published`}
              accent="green"
            />
          </div>

          <DashboardPanel
            title="Shortlisted schools"
            subtitle="Schools you saved while comparing options."
            action={
              <Link className="dash-link" href="/schools">
                Browse schools
              </Link>
            }
          >
            {removeError && (
              <p className="dash-state dash-state--error" role="alert">{removeError}</p>
            )}
            {data.shortlist.filter((item) => !removed[item.school_id]).length === 0 ? (
              <p className="dash-empty">
                No schools saved yet. Open a school and add it to your shortlist.
              </p>
            ) : (
              <ul className="dash-cards">
                {data.shortlist.filter((item) => !removed[item.school_id]).map((item) => (
                  <li className="dash-card" key={item.shortlist_id}>
                    <span className="dash-card__icon" aria-hidden>
                      <Bookmark size={18} />
                    </span>
                    <div>
                      <strong>
                        <Link
                          href={schoolProfilePathFromSlugs({
                            countrySlug: item.country_slug,
                            stateSlug: item.state_slug,
                            citySlug: item.city_slug,
                            localitySlug: item.location_slug,
                            schoolSlug: item.slug,
                          })}
                        >
                          {item.school_name}
                        </Link>
                      </strong>
                      <span>
                        {[item.city_name, item.state_name].filter(Boolean).join(", ")}
                        {item.note ? ` · ${item.note}` : ""}
                      </span>
                    </div>
                    <button
                      className="dash-link dash-link--button"
                      type="button"
                      onClick={() => void removeSchool(item.school_id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>

          <DashboardPanel title="Your children" subtitle="Profiles used when enquiring with schools.">
            {data.children.length === 0 ? (
              <p className="dash-empty">
                No children added yet. Add a child when you submit your next enquiry.
              </p>
            ) : (
              <ul className="dash-cards">
                {data.children.map((child) => (
                  <li className="dash-card" key={child.child_id}>
                    <span className="dash-card__icon" aria-hidden>
                      <GraduationCap size={18} />
                    </span>
                    <div>
                      <strong>{child.name}</strong>
                      <span>
                        {child.gender}
                        {child.date_of_birth ? ` · ${child.date_of_birth}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Recent enquiries"
            subtitle="Every school you contacted, newest first."
            action={<Star size={18} aria-hidden />}
          >
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>School</th>
                    <th>Status</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_enquiries.length === 0 && (
                    <EmptyTableRow colSpan={4} message="You have not sent any enquiries yet." />
                  )}
                  {data.recent_enquiries.map((enquiry) => (
                    <tr key={enquiry.enquiry_id}>
                      <td>{enquiry.enquiry_code}</td>
                      <td>{enquiry.school_name || "—"}</td>
                      <td>
                        <span className={`dash-badge dash-badge--${enquiry.status.toLowerCase()}`}>
                          {STATUS_LABELS[enquiry.status] ?? enquiry.status}
                        </span>
                      </td>
                      <td>{new Date(enquiry.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPanel>
        </>
      )}
    </DashboardShell>
  );
}
