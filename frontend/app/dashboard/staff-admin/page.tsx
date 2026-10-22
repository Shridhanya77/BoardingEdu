"use client";

import { ClipboardList, MessageSquare, Star } from "lucide-react";
import { dashboards } from "@/lib/api";
import {
  DashboardPanel,
  DashboardShell,
  DashboardState,
  EmptyTableRow,
  StatCard,
  useDashboardData,
} from "@/components/dashboard/DashboardShell";

export default function StaffAdminDashboardPage() {
  const { data, loading, error, reload } = useDashboardData(dashboards.staffAdmin);

  return (
    <DashboardShell
      roles={["STAFF_ADMIN", "SUPER_ADMIN"]}
      eyebrow="STAFF ADMIN DASHBOARD"
      title="Moderation & CRM queues"
      subtitle="Everything waiting on the operations team."
    >
      <DashboardState loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          <div className="dash-stats">
            <StatCard
              label="Reviews pending"
              value={data.queues.reviews_pending}
              hint="Awaiting moderation"
              accent="orange"
            />
            <StatCard
              label="Schools pending"
              value={data.queues.schools_pending}
              hint="Awaiting verification"
              accent="blue"
            />
            <StatCard label="New enquiries" value={data.queues.enquiries_new} />
            <StatCard
              label="Unassigned enquiries"
              value={data.queues.enquiries_unassigned}
              accent="green"
            />
            <StatCard label="Counselling requests" value={data.queues.counselling_new} />
          </div>

          <DashboardPanel
            title="This month's workload"
            subtitle="Volume handled by the operations team."
            action={<ClipboardList size={18} aria-hidden />}
          >
            <div className="dash-pills">
              <span className="dash-pill">
                Enquiries <strong>{data.workload.enquiries_this_month}</strong>
              </span>
              <span className="dash-pill">
                Reviews <strong>{data.workload.reviews_this_month}</strong>
              </span>
              <span className="dash-pill">
                Counselling <strong>{data.workload.counselling_this_month}</strong>
              </span>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Reviews awaiting moderation"
            subtitle="Ten most recent parent reviews."
            action={<Star size={18} aria-hidden />}
          >
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Author</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_reviews.length === 0 && (
                    <EmptyTableRow colSpan={5} message="No reviews submitted yet." />
                  )}
                  {data.recent_reviews.map((review) => (
                    <tr key={review.review_id}>
                      <td>{review.school_name}</td>
                      <td>{review.author_name || "Anonymous"}</td>
                      <td>{review.rating} / 5</td>
                      <td>
                        <span className={`dash-badge dash-badge--${review.status.toLowerCase()}`}>
                          {review.status}
                        </span>
                      </td>
                      <td>{new Date(review.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Newest enquiries"
            subtitle="Assign these to counsellors."
            action={<MessageSquare size={18} aria-hidden />}
          >
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>School</th>
                    <th>Parent</th>
                    <th>Priority</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_enquiries.length === 0 && (
                    <EmptyTableRow colSpan={5} message="No enquiries in the queue." />
                  )}
                  {data.recent_enquiries.map((enquiry) => (
                    <tr key={enquiry.enquiry_id}>
                      <td>{enquiry.enquiry_code}</td>
                      <td>{enquiry.school_name || "—"}</td>
                      <td>{enquiry.parent_name || "—"}</td>
                      <td>
                        <span className={`dash-badge dash-badge--${enquiry.priority.toLowerCase()}`}>
                          {enquiry.priority}
                        </span>
                      </td>
                      <td>{new Date(enquiry.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Schools pending verification" subtitle="Same queue as the admin dashboard.">
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Code</th>
                    <th>Location</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pending_schools.length === 0 && (
                    <EmptyTableRow colSpan={4} message="Nothing pending." />
                  )}
                  {data.pending_schools.map((school) => (
                    <tr key={school.school_id}>
                      <td>{school.school_name}</td>
                      <td>{school.school_code}</td>
                      <td>
                        {[school.city_name, school.state_name].filter(Boolean).join(", ")}
                      </td>
                      <td>{new Date(school.created_at).toLocaleDateString("en-IN")}</td>
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
