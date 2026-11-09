"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, ShieldX } from "lucide-react";
import { dashboards, setSchoolVerification } from "@/lib/api";
import {
  DashboardPanel,
  DashboardShell,
  DashboardState,
  EmptyTableRow,
  StatCard,
  useDashboardData,
} from "@/components/dashboard/DashboardShell";

export default function AdminDashboardPage() {
  const { data, loading, error, reload } = useDashboardData(dashboards.admin);
  const [busySchool, setBusySchool] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(schoolId: string, schoolName: string, approve: boolean) {
    setBusySchool(schoolId);
    setActionError(null);
    try {
      await setSchoolVerification(
        schoolId,
        approve ? "VERIFIED" : "UNVERIFIED",
        approve
          ? `Verified by admin from the dashboard (${schoolName}).`
          : `Rejected by admin from the dashboard (${schoolName}).`,
      );
      reload();
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "The verification update failed.",
      );
    } finally {
      setBusySchool(null);
    }
  }

  return (
    <DashboardShell
      roles={["SUPER_ADMIN", "STAFF_ADMIN"]}
      eyebrow="ADMIN DASHBOARD"
      title="Platform overview"
      subtitle="Schools, users, enquiries and reviews across BoardingEdu."
    >
      <DashboardState loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          <div className="dash-stats">
            <StatCard
              label="Schools"
              value={data.schools.total}
              hint={`${data.schools.listed} publicly listed`}
              accent="blue"
            />
            <StatCard
              label="Pending verification"
              value={data.schools.pending_verification}
              hint="Needs an admin decision"
              accent="orange"
            />
            <StatCard label="Verified schools" value={data.schools.verified} accent="green" />
            <StatCard label="Cities covered" value={data.coverage.cities_covered} />
            <StatCard
              label="Users"
              value={data.users.total}
              hint={`${data.users.new_this_month} joined this month`}
            />
            <StatCard
              label="Enquiries"
              value={data.enquiries.total}
              hint={`${data.enquiries.this_month} this month`}
            />
            <StatCard
              label="Reviews"
              value={data.reviews.total}
              hint={`${data.reviews.by_status.PENDING ?? 0} pending moderation`}
            />
          <StatCard
            label="Counselling requests"
            value={data.counselling.total}
            hint={`${data.counselling.new} new`}
            accent="orange"
          />
          <StatCard label="Missing logos" value={data.data_quality.missing_logo} hint="Schools without a logo" accent="orange" />
          <StatCard label="Missing covers" value={data.data_quality.missing_cover} hint="No campus photograph" />
          <StatCard label="Missing boards" value={data.data_quality.missing_board} hint="No education board" />
          <StatCard label="Unpublished fees" value={data.data_quality.missing_published_fees} hint="No published fee structure" />
        </div>

        <DashboardPanel title="Schools by type" subtitle="Each school can belong to more than one type.">
          <div className="sa-bars">
            {data.school_types.map((row) => (
              <div key={row.type_name}>
                <span>{row.type_name}</span>
                <div>
                  <i style={{ width: `${Math.max(6, (row.total / Math.max(1, data.schools.total)) * 100)}%` }} />
                </div>
                <strong>{row.total}</strong>
              </div>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Data quality" subtitle="Missing information is not treated as unavailable. Open the school and fill it in.">
          <div className="dash-pills">
            <span className="dash-pill">Missing description <strong>{data.data_quality.missing_about}</strong></span>
            <span className="dash-pill">Missing contact <strong>{data.data_quality.missing_contact}</strong></span>
            <span className="dash-pill">Missing locality <strong>{data.data_quality.missing_locality}</strong></span>
            <span className="dash-pill">Unverified <strong>{data.data_quality.unverified}</strong></span>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Recently updated schools" subtitle="Latest profile activity across the platform.">
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr><th>School</th><th>City</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.recent_schools.map((school) => (
                  <tr key={school.school_id}>
                    <td>{school.school_name}<span className="sa-muted">{school.school_code}</span></td>
                    <td>{school.city_name}</td>
                    <td>{school.verification_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>

          <DashboardPanel title="Users by role" subtitle="Who is on the platform.">
            <div className="dash-pills">
              <span className="dash-pill">
                Parents <strong>{data.users.parents}</strong>
              </span>
              <span className="dash-pill">
                School admins <strong>{data.users.school_admins}</strong>
              </span>
              <span className="dash-pill">
                Staff admins <strong>{data.users.staff_admins}</strong>
              </span>
              <span className="dash-pill">
                Super admins <strong>{data.users.super_admins}</strong>
              </span>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Schools awaiting verification"
            subtitle="Approve a school to list it publicly. School admins can complete their profile before approval."
          >
            {actionError && (
              <p className="dash-state dash-state--error" role="alert">
                {actionError}
              </p>
            )}
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Code</th>
                    <th>Location</th>
                    <th>Registered</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pending_schools.length === 0 && (
                    <EmptyTableRow colSpan={5} message="Nothing pending — every school is reviewed." />
                  )}
                  {data.pending_schools.map((school) => (
                    <tr key={school.school_id}>
                      <td>{school.school_name}</td>
                      <td>{school.school_code}</td>
                      <td>
                        {[school.city_name, school.state_name].filter(Boolean).join(", ")}
                      </td>
                      <td>{new Date(school.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="dash-table__actions">
                        <button
                          className="dash-action dash-action--approve"
                          type="button"
                          disabled={busySchool === school.school_id}
                          onClick={() => decide(school.school_id, school.school_name, true)}
                        >
                          {busySchool === school.school_id ? (
                            <Loader2 size={14} className="spin" aria-hidden />
                          ) : (
                            <BadgeCheck size={14} aria-hidden />
                          )}
                          Approve
                        </button>
                        <button
                          className="dash-action dash-action--reject"
                          type="button"
                          disabled={busySchool === school.school_id}
                          onClick={() => decide(school.school_id, school.school_name, false)}
                        >
                          <ShieldX size={14} aria-hidden />
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Recent enquiries" subtitle="Latest requests from families.">
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>School</th>
                    <th>Parent</th>
                    <th>Status</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_enquiries.length === 0 && (
                    <EmptyTableRow colSpan={5} message="No enquiries have been submitted yet." />
                  )}
                  {data.recent_enquiries.map((enquiry) => (
                    <tr key={enquiry.enquiry_id}>
                      <td>{enquiry.enquiry_code}</td>
                      <td>{enquiry.school_name || "—"}</td>
                      <td>{enquiry.parent_name || "—"}</td>
                      <td>
                        <span className={`dash-badge dash-badge--${enquiry.status.toLowerCase()}`}>
                          {enquiry.status}
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
