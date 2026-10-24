"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BadgeCheck, Hourglass, Inbox, Pencil, Save, Star, X } from "lucide-react";
import {
  apiErrorMessage,
  dashboards,
  schools,
  type EnquiryStatus,
  type SchoolPortalData,
  type SchoolPortalUpdate,
} from "@/lib/api";
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

export default function SchoolDashboardPage() {
  const { data, loading, error, reload } = useDashboardData(dashboards.school);
  const [portalProfile, setPortalProfile] = useState<SchoolPortalData | null>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalSuccess, setPortalSuccess] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<string, EnquiryStatus>>({});
  const [savingEnquiry, setSavingEnquiry] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function changeEnquiryStatus(enquiryId: string, status: EnquiryStatus) {
    setSavingEnquiry(enquiryId);
    setStatusError(null);
    try {
      await dashboards.updateEnquiryStatus(enquiryId, status);
      setStatusById((current) => ({ ...current, [enquiryId]: status }));
    } catch (reason) {
      setStatusError(apiErrorMessage(reason));
    } finally {
      setSavingEnquiry(null);
    }
  }

  async function toggleProfileEditor() {
    setPortalError(null);
    setPortalSuccess(null);
    if (portalOpen) {
      setPortalOpen(false);
      return;
    }
    setPortalOpen(true);
    if (portalProfile) return;
    setPortalLoading(true);
    try {
      setPortalProfile(await schools.mine());
    } catch (reason) {
      setPortalError(apiErrorMessage(reason));
    } finally {
      setPortalLoading(false);
    }
  }

  function updatePortalField<K extends keyof SchoolPortalUpdate>(
    field: K,
    value: SchoolPortalUpdate[K],
  ) {
    setPortalProfile((current) => current ? { ...current, [field]: value } : current);
    setPortalError(null);
    setPortalSuccess(null);
  }

  async function savePortalProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portalProfile) return;
    setPortalSaving(true);
    setPortalError(null);
    setPortalSuccess(null);
    const payload: SchoolPortalUpdate = {
      short_name: portalProfile.short_name,
      tagline: portalProfile.tagline,
      about: portalProfile.about,
      website: portalProfile.website,
      phone: portalProfile.phone,
      email: portalProfile.email,
      principal_name: portalProfile.principal_name,
      address: portalProfile.address,
      pincode: portalProfile.pincode,
      established_year: portalProfile.established_year,
      school_logo_url: portalProfile.school_logo_url,
      school_image_url: portalProfile.school_image_url,
      admission_open: portalProfile.admission_open,
    };
    try {
      const updated = await schools.updateMine(payload);
      setPortalProfile(updated);
      setPortalSuccess("Your school profile has been updated.");
    } catch (reason) {
      setPortalError(apiErrorMessage(reason));
    } finally {
      setPortalSaving(false);
    }
  }

  return (
    <DashboardShell
      roles={["SCHOOL_ADMIN"]}
      eyebrow="SCHOOL DASHBOARD"
      title={data?.school.school_name ?? "Your school at a glance"}
      subtitle={
        data?.panel_access === "pending"
          ? "Your school admin panel opens after BoardingEdu verifies the school."
          : "Enquiries, reviews and the profile parents see."
      }
    >
      <DashboardState loading={loading} error={error} onRetry={reload} />

      {data?.panel_access === "pending" && (
        <DashboardPanel
          title="Waiting for verification"
          subtitle="A platform admin has to approve the school before this panel can manage enquiries or the public profile."
        >
          <div className="dash-gate">
            <span className="dash-gate__icon" aria-hidden>
              <Hourglass size={22} />
            </span>
            <div>
              <strong>{data.school.school_name}</strong>
              <p>
                Status: {data.school.verification_status}. You can sign in and watch this page.
                Editing the listing, and the enquiry pipeline, stay locked until the school is verified.
              </p>
            </div>
          </div>
        </DashboardPanel>
      )}

      {data?.panel_access === "admin" && (
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
              <div className="dash-panel__actions">
                <button
                  className="dash-link dash-link--button"
                  type="button"
                  onClick={() => void toggleProfileEditor()}
                  aria-expanded={portalOpen}
                >
                  <Pencil size={14} aria-hidden />
                  {portalOpen ? "Close editor" : "Edit profile"}
                </button>
                {data.school.slug ? (
                  <Link
                    className="dash-link"
                    href={schoolProfilePathFromSlugs({
                      countrySlug: data.school.country_slug,
                      stateSlug: data.school.state_slug,
                      citySlug: data.school.city_slug,
                      localitySlug: data.school.location_slug,
                      schoolSlug: data.school.slug,
                    })}
                  >
                    View public profile
                  </Link>
                ) : null}
              </div>
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
            {data.school.profile_gaps.length > 0 && (
              <ul className="dash-gaps">
                {data.school.profile_gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            )}
            {portalOpen && (
              <div className="school-portal-editor">
                <div className="school-portal-editor__heading">
                  <div>
                    <h3>Manage your public profile</h3>
                    <p>Updates are shown on your school listing after you save.</p>
                  </div>
                  <button
                    className="school-portal-editor__close"
                    type="button"
                    onClick={() => setPortalOpen(false)}
                    aria-label="Close profile editor"
                  >
                    <X size={17} aria-hidden />
                  </button>
                </div>
                {portalLoading && (
                  <p className="dash-state" role="status">Loading profile…</p>
                )}
                {portalError && (
                  <p className="school-portal-editor__error" role="alert">{portalError}</p>
                )}
                {portalSuccess && (
                  <p className="school-portal-editor__success" role="status">{portalSuccess}</p>
                )}
                {portalProfile && (
                  <form className="school-portal-form" onSubmit={savePortalProfile}>
                    <label>
                      Short name
                      <input
                        value={portalProfile.short_name}
                        maxLength={50}
                        onChange={(event) => updatePortalField("short_name", event.target.value)}
                      />
                    </label>
                    <label>
                      Profile tagline
                      <input
                        value={portalProfile.tagline}
                        maxLength={200}
                        onChange={(event) => updatePortalField("tagline", event.target.value)}
                      />
                    </label>
                    <label className="school-portal-form__wide">
                      About the school
                      <textarea
                        value={portalProfile.about}
                        rows={5}
                        onChange={(event) => updatePortalField("about", event.target.value)}
                      />
                    </label>
                    <label>
                      Website
                      <input
                        type="url"
                        value={portalProfile.website}
                        onChange={(event) => updatePortalField("website", event.target.value)}
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        type="tel"
                        value={portalProfile.phone}
                        onChange={(event) => updatePortalField("phone", event.target.value)}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={portalProfile.email}
                        onChange={(event) => updatePortalField("email", event.target.value)}
                      />
                    </label>
                    <label>
                      Principal / contact name
                      <input
                        value={portalProfile.principal_name}
                        onChange={(event) => updatePortalField("principal_name", event.target.value)}
                      />
                    </label>
                    <label className="school-portal-form__wide">
                      Address
                      <textarea
                        value={portalProfile.address}
                        rows={2}
                        onChange={(event) => updatePortalField("address", event.target.value)}
                      />
                    </label>
                    <label>
                      Postal code
                      <input
                        value={portalProfile.pincode}
                        onChange={(event) => updatePortalField("pincode", event.target.value)}
                      />
                    </label>
                    <label>
                      Established year
                      <input
                        type="number"
                        min={1800}
                        max={2100}
                        value={portalProfile.established_year ?? ""}
                        onChange={(event) =>
                          updatePortalField(
                            "established_year",
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
                      />
                    </label>
                    <label className="school-portal-form__wide">
                      School logo URL
                      <input
                        type="url"
                        value={portalProfile.school_logo_url}
                        onChange={(event) => updatePortalField("school_logo_url", event.target.value)}
                      />
                    </label>
                    <label className="school-portal-form__wide">
                      Campus image URL
                      <input
                        type="url"
                        value={portalProfile.school_image_url}
                        onChange={(event) => updatePortalField("school_image_url", event.target.value)}
                      />
                    </label>
                    <label className="school-portal-form__toggle">
                      <input
                        type="checkbox"
                        checked={portalProfile.admission_open}
                        onChange={(event) => updatePortalField("admission_open", event.target.checked)}
                      />
                      Currently accepting admission enquiries
                    </label>
                    <button className="school-portal-form__save" type="submit" disabled={portalSaving}>
                      <Save size={16} aria-hidden />
                      {portalSaving ? "Saving…" : "Save profile"}
                    </button>
                  </form>
                )}
              </div>
            )}
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

          <DashboardPanel title="Recent enquiries" subtitle="Update the status as your admissions team follows up.">
            {statusError && (
              <p className="dash-state dash-state--error" role="alert">{statusError}</p>
            )}
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
                  {data.recent_enquiries.map((enquiry) => {
                    const status = statusById[enquiry.enquiry_id] ?? enquiry.status;
                    return (
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
                        <label className="dash-status">
                          <span className="sr-only">Status for {enquiry.enquiry_code}</span>
                          <select
                            value={status}
                            disabled={savingEnquiry === enquiry.enquiry_id}
                            onChange={(event) =>
                              void changeEnquiryStatus(
                                enquiry.enquiry_id,
                                event.target.value as EnquiryStatus,
                              )
                            }
                          >
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </td>
                      <td>{new Date(enquiry.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DashboardPanel>
        </>
      )}
    </DashboardShell>
  );
}
