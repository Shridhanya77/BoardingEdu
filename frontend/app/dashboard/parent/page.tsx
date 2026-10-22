"use client";

import { GraduationCap, Star } from "lucide-react";
import { dashboards } from "@/lib/api";
import {
  DashboardPanel,
  DashboardShell,
  DashboardState,
  EmptyTableRow,
  StatCard,
  useDashboardData,
} from "@/components/dashboard/DashboardShell";

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
            <StatCard
              label="Reviews written"
              value={data.stats.reviews_total}
              hint={`${data.stats.reviews_published} published`}
              accent="green"
            />
          </div>

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
