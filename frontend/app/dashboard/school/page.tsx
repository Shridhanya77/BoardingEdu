"use client";

import Link from "next/link";
import { BadgeCheck, Inbox, Star } from "lucide-react";
import { dashboards } from "@/lib/api";
import {
  DashboardPanel,
  DashboardShell,
  DashboardState,
  EmptyTableRow,
  StatCard,
  useDashboardData,
} from "@/components/dashboard/DashboardShell";
import { schoolProfilePathFromSlugs, schoolProfileTypeSegment } from "@/lib/seo-slugs";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  CALL_BACK: "Callback scheduled",
  CONVERTED: "Converted",
  CLOSED_LOST: "Closed",
  SPAM: "Spam",
};

export default function SchoolDashboardPage() {
  const { data, loading, error, reload } = useDashboardData(dashboards.school);

  return (
    <DashboardShell
      roles={["SCHOOL_ADMIN", "STAFF_ADMIN", "SUPER_ADMIN"]}
      eyebrow="SCHOOL DASHBOARD"
      title={data?.school.school_name ?? "Your school at a glance"}
      subtitle="Enquiries, reviews and the profile parents see."
    >
      <DashboardState loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          <div className="dash-stats">
            <StatCard label="Total enquiries" value={data.stats.enquiries_total} accent="blue" />
            <StatCard
              label="New enquiries"
              value={data.stats.enquiries_new}
              hint="Awaiting a first response"
              accent="orange"
            />
            <StatCard label="Enquiries this month" value={data.stats.enquiries_this_month} />
            <StatCard label="Converted" value={data.stats.enquiries_converted} accent="green" />
            <StatCard
              label="Average rating"
              value={data.stats.average_rating == null ? "—" : data.stats.average_rating.toFixed(1)}
              hint={`${data.stats.reviews_published} published reviews`}
            />
            <StatCard
              label="Reviews awaiting moderation"
              value={data.stats.reviews_pending}
            />
          </div>

          <DashboardPanel
            title="School profile"
            subtitle="What parents see when they find your school."
            action={
              data.school.slug ? (
                <Link
                  className="dash-link"
                  href={schoolProfilePathFromSlugs({
                    countrySlug: data.school.country_slug,
                    stateSlug: data.school.state_slug,
                    citySlug: data.school.city_slug,
                    localitySlug: data.school.location_slug,
                    schoolSlug: data.school.slug,
                    typeSegment: schoolProfileTypeSegment(data.school.school_types_detail),
                  })}
                >
                  View public profile
                </Link>
              ) : null
            }
          >
            <div className="dash-profile">
              <div className="dash-profile__row">
                <span>School code</span>
                <strong>{data.school.school_code}</strong>
              </div>
              <div className="dash-profile__row">
                <span>Location</span>
                <strong>
                  {[data.school.city_name, data.school.state_name].filter(Boolean).join(", ")}
                </strong>
              </div>
              <div className="dash-profile__row">
                <span>Verification</span>
                <strong className="dash-verified">
                  <BadgeCheck size={15} aria-hidden /> {data.school.verification_status}
                </strong>
              </div>
              <div className="dash-profile__row">
                <span>Profile completeness</span>
                <strong>{data.school.profile_completeness}%</strong>
              </div>
            </div>
            <div className="dash-progress" aria-hidden>
              <span style={{ width: `${data.school.profile_completeness}%` }} />
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Enquiry pipeline"
            subtitle="Where your admission enquiries currently sit."
            action={<Inbox size={18} aria-hidden />}
          >
            <div className="dash-pills">
              {Object.entries(data.enquiry_status).map(([status, total]) => (
                <span className="dash-pill" key={status}>
                  {STATUS_LABELS[status] ?? status}
                  <strong>{total}</strong>
                </span>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel title="Recent enquiries" subtitle="The ten latest families who reached out.">
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Parent</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_enquiries.length === 0 && (
                    <EmptyTableRow colSpan={5} message="No enquiries yet." />
                  )}
                  {data.recent_enquiries.map((enquiry) => (
                    <tr key={enquiry.enquiry_id}>
                      <td>
                        <Star size={13} aria-hidden /> {enquiry.enquiry_code}
                      </td>
                      <td>{enquiry.parent_name || "—"}</td>
                      <td>
                        {enquiry.parent_phone || "—"}
                        {enquiry.parent_email && <small>{enquiry.parent_email}</small>}
                      </td>
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
