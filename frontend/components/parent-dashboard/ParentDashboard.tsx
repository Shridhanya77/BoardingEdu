"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bookmark, Check, FileText, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DashboardPanel,
  DashboardShell,
  DashboardState,
  StatCard,
  useDashboardData,
} from "@/components/dashboard/DashboardShell";
import ParentSchoolFinder from "@/components/parent-dashboard/ParentSchoolFinder";
import {
  apiErrorMessage,
  dashboards,
  parentChildren,
  parentApplications,
  users,
  type ParentChildRecord,
  type ParentApplication,
  type ParentProfileData,
} from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";

const SECTIONS = [
  ["dashboard", "Dashboard"],
  ["applications", "My Applications"],
  ["students", "My Children"],
  ["finder", "Find Schools"],
  ["shortlist", "Shortlisted Schools"],
  ["documents", "Documents"],
  ["notifications", "Notifications"],
  ["messages", "Messages"],
  ["profile", "My Profile"],
  ["settings", "Settings"],
] as const;

type SectionId = (typeof SECTIONS)[number][0];

const STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "submitted",
  RECEIVED: "received",
  UNDER_REVIEW: "review",
  DOCUMENTS_REQUIRED: "action",
  INTERACTION_SCHEDULED: "review",
  INTERACTION_COMPLETED: "review",
  OFFERED: "offered",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
};

export function applicationStatusClass(status: string) {
  return STATUS_CLASS[status] ?? "submitted";
}

const ADMISSION_STAGES = ["Submitted", "Received", "Review", "Documents", "Interaction", "Offer", "Decision"];

function applicationStageIndex(status: string) {
  switch (status) {
    case "SUBMITTED": return 0;
    case "RECEIVED": return 1;
    case "UNDER_REVIEW": return 2;
    case "DOCUMENTS_REQUIRED": return 3;
    case "INTERACTION_SCHEDULED": return 4;
    case "INTERACTION_COMPLETED": return 4;
    case "OFFERED": return 5;
    case "ACCEPTED":
    case "REJECTED": return 6;
    default: return -1;
  }
}

export function AdmissionProgress({ status }: { status: string }) {
  const current = applicationStageIndex(status);
  if (status === "WITHDRAWN") {
    return <p className="pd-progress__closed">This application was withdrawn.</p>;
  }
  return (
    <ol className="pd-progress" aria-label="Admission progress">
      {ADMISSION_STAGES.map((stage, index) => (
        <li
          key={stage}
          className={index < current ? "is-complete" : index === current ? "is-current" : ""}
          aria-current={index === current ? "step" : undefined}
        >
          <span>{index < current ? <Check size={13} aria-hidden /> : index + 1}</span>
          <small>{stage}</small>
        </li>
      ))}
    </ol>
  );
}

export default function ParentDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("section");
  const section: SectionId = SECTIONS.some(([id]) => id === requested) ? (requested as SectionId) : "dashboard";
  const { data, loading, error, reload } = useDashboardData(dashboards.parent);
  const [applications, setApplications] = useState<ParentApplication[] | null>(null);
  const [profile, setProfile] = useState<ParentProfileData | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setLocalError(null);
    if (section === "dashboard" || section === "applications" || section === "documents" || section === "messages") {
      let active = true;
      parentApplications.list()
        .then((rows) => { if (active) setApplications(rows); })
        .catch((reason: unknown) => { if (active) setLocalError(apiErrorMessage(reason)); });
      return () => { active = false; };
    }
    if (section === "profile") {
      let active = true;
      parentApplications.profile()
        .then((value) => { if (active) setProfile(value); })
        .catch((reason: unknown) => { if (active) setLocalError(apiErrorMessage(reason)); });
      return () => { active = false; };
    }
  }, [section, data]);

  function openSection(next: SectionId) {
    router.replace(next === "dashboard" ? "/dashboard/parent/" : `/dashboard/parent/?section=${next}`);
  }

  return (
    <DashboardShell
      roles={["PARENT"]}
      eyebrow="PARENT DASHBOARD"
      title="Track your admission applications"
      subtitle="See every school you have applied to, school updates, and documents still needed."
    >
      <nav className="pd-nav" aria-label="Parent dashboard">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={section === id ? "is-active" : ""}
            onClick={() => openSection(id)}
          >
            {label}
            {id === "notifications" && data?.stats.notifications_unread ? (
              <span>{data.stats.notifications_unread}</span>
            ) : null}
          </button>
        ))}
      </nav>
      <DashboardState loading={loading} error={error} onRetry={reload} />
      {localError && <p className="dash-state dash-state--error" role="alert">{localError}</p>}
      {data && section === "dashboard" && (
        <>
          <div className="dash-stats">
            <StatCard label="Total applications" value={data.stats.applications_total} accent="blue" />
            <StatCard label="Under review" value={data.stats.applications_under_review} />
            <StatCard label="In progress" value={data.stats.applications_in_progress} accent="orange" />
            <StatCard label="Accepted" value={data.stats.applications_accepted} accent="green" />
            <StatCard label="Rejected" value={data.stats.applications_rejected} />
            <StatCard label="Action required" value={data.stats.applications_action_required} accent="orange" />
          </div>
          <DashboardPanel title="Latest updates" subtitle="Status changes from schools appear here.">
            {data.notifications.length === 0 ? (
              <p className="dash-empty">No updates yet. New school responses will show up here.</p>
            ) : (
              <ul className="pd-list">
                {data.notifications.map((note) => (
                  <li key={note.notification_id}>
                    <strong>{note.title}</strong>
                    <span>{note.body}</span>
                    {note.enquiry_id && (
                      <Link href={`/dashboard/parent/applications/${note.enquiry_id}/`}>View application</Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>
          <ApplicationList
            applications={applications}
            fallback={data.recent_enquiries.map((row) => row.enquiry_id)}
            maxRows={4}
            showFilters={false}
          />
        </>
      )}
      {data && section === "applications" && (
        <ApplicationList applications={applications} fallback={data.recent_enquiries.map((row) => row.enquiry_id)} />
      )}
      {data && section === "students" && (
        <StudentManager />
      )}
      {data && section === "finder" && <ParentSchoolFinder />}
      {data && section === "shortlist" && <Shortlist data={data} onError={setLocalError} />}
      {section === "documents" && <DocumentSummary applications={applications} />}
      {data && section === "notifications" && <NotificationList notes={data.notifications} onChanged={reload} />}
      {section === "messages" && <MessageSummary applications={applications} />}
      {section === "profile" && <ProfileForm profile={profile} onSaved={setProfile} />}
      {section === "settings" && <PasswordSettings />}
    </DashboardShell>
  );
}

function ApplicationList({
  applications,
  fallback,
  maxRows,
  showFilters = true,
}: {
  applications: ParentApplication[] | null;
  fallback: string[];
  maxRows?: number;
  showFilters?: boolean;
}) {
  const [filter, setFilter] = useState("ALL");
  const allRows = applications ?? [];
  const matchingRows = allRows.filter((application) => {
    if (filter === "ACTION_REQUIRED") return application.application_status === "DOCUMENTS_REQUIRED";
    if (filter === "ACCEPTED") return application.application_status === "ACCEPTED";
    if (filter === "CLOSED") return ["REJECTED", "WITHDRAWN"].includes(application.application_status);
    if (filter === "ACTIVE") return !["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(application.application_status);
    return true;
  });
  const rows = maxRows ? matchingRows.slice(0, maxRows) : matchingRows;
  return (
    <DashboardPanel
      title={maxRows ? "Application progress" : "My applications"}
      subtitle="Track each school's updates, next steps, and document requests."
      action={maxRows ? <Link className="dash-link" href="/dashboard/parent/?section=applications">View all</Link> : undefined}
    >
      {showFilters && applications && (
        <div className="pd-app-filters" aria-label="Filter applications">
          {[
            ["ALL", "All", allRows.length],
            ["ACTIVE", "In progress", allRows.filter((item) => !["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(item.application_status)).length],
            ["ACTION_REQUIRED", "Action needed", allRows.filter((item) => item.application_status === "DOCUMENTS_REQUIRED").length],
            ["ACCEPTED", "Accepted", allRows.filter((item) => item.application_status === "ACCEPTED").length],
            ["CLOSED", "Closed", allRows.filter((item) => ["REJECTED", "WITHDRAWN"].includes(item.application_status)).length],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "is-active" : ""}
              aria-pressed={filter === value}
              onClick={() => setFilter(String(value))}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
      )}
      {!applications && <p className="dash-empty">Loading your applications…</p>}
      {applications && rows.length === 0 && allRows.length === 0 && (
        <p className="dash-empty">You have not applied to a school yet.</p>
      )}
      {applications && rows.length === 0 && allRows.length > 0 && (
        <p className="dash-empty">No applications match this filter.</p>
      )}
      <ul className="pd-apps">
        {rows.map((application) => (
          <li key={application.enquiry_id}>
            <div>
              <strong>{application.school.school_name}</strong>
              <span>
                {application.enquiry_code}
                {application.grade_name ? ` · ${application.grade_name}` : ""}
                {application.academic_year ? ` · ${application.academic_year}` : ""}
              </span>
              <span>{[application.school.city_name, application.school.state_name].filter(Boolean).join(", ")}</span>
              <AdmissionProgress status={application.application_status} />
              {application.application_status === "DOCUMENTS_REQUIRED" && (
                <DocumentRequestHint application={application} />
              )}
            </div>
            <em className={`pd-badge pd-badge--${applicationStatusClass(application.application_status)}`}>
              {application.application_status_label}
            </em>
            <Link href={`/dashboard/parent/applications/${application.enquiry_id}/`}>View details</Link>
          </li>
        ))}
      </ul>
      {!applications && fallback.length > 0 && (
        <p className="dash-empty">Your application list is being loaded.</p>
      )}
    </DashboardPanel>
  );
}

function DocumentRequestHint({ application }: { application: ParentApplication }) {
  const latest = application.timeline?.slice(-1)[0];
  const request = latest?.instructions || latest?.remarks;
  return (
    <p className="pd-document-request">
      <strong>Action needed:</strong> {request || "The school has requested additional documents."}
    </p>
  );
}

function isChildGender(value: string): value is ParentChildRecord["gender"] {
  return value === "MALE" || value === "FEMALE" || value === "OTHER";
}

function StudentManager() {
  const [children, setChildren] = useState<ParentChildRecord[] | null>(null);
  const [editing, setEditing] = useState<ParentChildRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return parentChildren.list()
      .then((response) => setChildren(Array.isArray(response) ? response : response.results))
      .catch((reason: unknown) => setError(apiErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function saveChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();
    const dob = String(values.get("dob") || "");
    const genderValue = String(values.get("gender") || "");
    if (!name || !dob || !isChildGender(genderValue)) {
      setError("Enter the child's name, date of birth, and gender.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = { name, dob, gender: genderValue };
    const request = editing
      ? parentChildren.update(editing.child_id, payload)
      : parentChildren.create(payload);
    request
      .then(() => {
        form.reset();
        setEditing(null);
        setNotice(editing ? "Child details updated." : "Child added to your account.");
        return load();
      })
      .catch((reason: unknown) => setError(apiErrorMessage(reason)))
      .finally(() => setSaving(false));
  }

  function removeChild(child: ParentChildRecord) {
    if (!window.confirm(`Remove ${child.name} from your child profiles?`)) return;
    setError(null);
    setNotice(null);
    parentChildren.remove(child.child_id)
      .then(() => {
        setChildren((current) => (current ?? []).filter((item) => item.child_id !== child.child_id));
        if (editing?.child_id === child.child_id) setEditing(null);
        setNotice(`${child.name} was removed.`);
      })
      .catch((reason: unknown) => setError(apiErrorMessage(reason)));
  }

  return (
    <DashboardPanel title="My children" subtitle="Keep each child's details ready for school enquiries and applications.">
      {error && <p className="dash-state dash-state--error" role="alert">{error}</p>}
      {notice && <p className="pd-notice" role="status">{notice}</p>}
      {loading ? (
        <p className="dash-empty">Loading child profiles…</p>
      ) : children && children.length > 0 ? (
        <ul className="pd-children">
          {children.map((child) => (
            <li key={child.child_id}>
              <span className="pd-children__icon" aria-hidden><GraduationCap size={19} /></span>
              <div>
                <strong>{child.name}</strong>
                <span>{child.dob} · {child.gender.toLowerCase()}</span>
                {child.current_grade_name && <small>Current class: {child.current_grade_name}</small>}
              </div>
              <div className="pd-children__actions">
                <button type="button" onClick={() => setEditing(child)} aria-label={`Edit ${child.name}`}>
                  <Pencil size={15} aria-hidden /> Edit
                </button>
                <button type="button" onClick={() => removeChild(child)} aria-label={`Remove ${child.name}`}>
                  <Trash2 size={15} aria-hidden /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-empty">No child profiles yet. Add a child to keep application details together.</p>
      )}

      <form className="pd-form pd-child-form" key={editing?.child_id ?? "new-child"} onSubmit={saveChild}>
        <h3>{editing ? `Update ${editing.name}'s details` : "Add a child"}</h3>
        <label>
          Child&apos;s name
          <input name="name" defaultValue={editing?.name ?? ""} autoComplete="off" required maxLength={100} />
        </label>
        <label>
          Date of birth
          <input name="dob" type="date" defaultValue={editing?.dob ?? ""} required />
        </label>
        <label>
          Gender
          <select name="gender" defaultValue={editing?.gender ?? ""} required>
            <option value="" disabled>Select gender</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <div className="pd-child-form__actions">
          <button className="primary-button" type="submit" disabled={saving}>
            <Plus size={16} aria-hidden /> {saving ? "Saving…" : editing ? "Save changes" : "Add child"}
          </button>
          {editing && (
            <button className="pd-secondary-button" type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </DashboardPanel>
  );
}

function Shortlist({
  data,
  onError,
}: {
  data: NonNullable<Awaited<ReturnType<typeof dashboards.parent>>>;
  onError: (message: string) => void;
}) {
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  return (
    <DashboardPanel
      title="Shortlisted schools"
      action={<Link className="dash-link" href="/compare">Compare schools</Link>}
    >
      <ul className="dash-cards">
        {data.shortlist.filter((item) => !removed[item.school_id]).map((item) => (
          <li className="dash-card" key={item.shortlist_id}>
            <span className="dash-card__icon" aria-hidden><Bookmark size={18} /></span>
            <div>
              <strong>
                <Link href={schoolProfilePathFromSlugs({
                  countrySlug: item.country_slug,
                  stateSlug: item.state_slug,
                  citySlug: item.city_slug,
                  localitySlug: item.location_slug,
                  schoolSlug: item.slug,
                  schoolTypes: item.school_types_detail,
                })}
                >
                  {item.school_name}
                </Link>
              </strong>
              <span>{[item.city_name, item.state_name].filter(Boolean).join(", ")}</span>
            </div>
            <button
              className="dash-link dash-link--button"
              type="button"
              onClick={() => {
                dashboards.removeShortlist(item.school_id)
                  .then(() => setRemoved((current) => ({ ...current, [item.school_id]: true })))
                  .catch((reason) => onError(apiErrorMessage(reason)));
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}

function DocumentSummary({ applications }: { applications: ParentApplication[] | null }) {
  const documents = (applications ?? []).flatMap((application) =>
    (application.documents ?? []).map((document) => ({ ...document, school: application.school.school_name, enquiry_id: application.enquiry_id })),
  );
  const requests = (applications ?? []).filter((application) => application.application_status === "DOCUMENTS_REQUIRED");
  return (
    <DashboardPanel title="Documents" subtitle="Track school requests and review the files you have uploaded.">
      {!applications ? (
        <p className="dash-empty">Loading your document status…</p>
      ) : (
        <>
          <section className="pd-document-requests">
            <h3>School requests</h3>
            {requests.length === 0 ? (
              <p className="dash-empty">No schools are currently requesting additional documents.</p>
            ) : (
              <ul className="pd-list">
                {requests.map((application) => (
                  <li key={application.enquiry_id}>
                    <strong>{application.school.school_name}</strong>
                    <DocumentRequestHint application={application} />
                    <Link href={`/dashboard/parent/applications/${application.enquiry_id}/`}>Open application and upload</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="pd-uploaded-documents">
            <h3>Uploaded documents</h3>
            {documents.length === 0 ? (
              <p className="dash-empty">No documents uploaded yet.</p>
            ) : (
              <ul className="pd-list">
                {documents.map((document) => (
                  <li key={document.document_id}>
                    <FileText size={16} aria-hidden />
                    <strong>{document.document_type_label}</strong>
                    <span>{document.school} · {document.original_name}</span>
                    <em className={`pd-badge pd-badge--${document.review_status.toLowerCase()}`}>
                      {document.review_status.replace("_", " ")}
                    </em>
                    <Link href={`/dashboard/parent/applications/${document.enquiry_id}/`}>Open</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </DashboardPanel>
  );
}

function MessageSummary({ applications }: { applications: ParentApplication[] | null }) {
  const messages = (applications ?? []).flatMap((application) =>
    (application.messages ?? []).map((message) => ({ ...message, school: application.school.school_name, enquiry_id: application.enquiry_id })),
  );
  return (
    <DashboardPanel title="Messages" subtitle="Replies stay with the application they belong to.">
      {messages.length === 0 ? (
        <p className="dash-empty">No messages yet.</p>
      ) : (
        <ul className="pd-list">
          {messages.map((message) => (
            <li key={message.message_id}>
              <strong>{message.school}</strong>
              <span>{message.body}</span>
              <Link href={`/dashboard/parent/applications/${message.enquiry_id}/`}>Reply</Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

function NotificationList({
  notes,
  onChanged,
}: {
  notes: { notification_id: string; title: string; body: string; enquiry_id: string | null; read: boolean }[];
  onChanged: () => void;
}) {
  return (
    <DashboardPanel title="Notifications">
      <button
        className="dash-link dash-link--button"
        type="button"
        onClick={() => { parentApplications.markRead().then(onChanged).catch(() => undefined); }}
      >
        Mark all as read
      </button>
      <ul className="pd-list">
        {notes.map((note) => (
          <li key={note.notification_id}>
            <strong>{note.title}</strong>
            <span>{note.body}</span>
            {!note.read && (
              <button type="button" onClick={() => { parentApplications.markRead(note.notification_id).then(onChanged).catch(() => undefined); }}>
                Mark read
              </button>
            )}
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: ParentProfileData | null;
  onSaved: (profile: ParentProfileData) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  if (!profile) return <p className="dash-empty">Loading your profile…</p>;
  return (
    <DashboardPanel title="My profile">
      <form
        className="pd-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          parentApplications.updateProfile({
            first_name: String(form.get("first_name") || ""),
            last_name: String(form.get("last_name") || ""),
            phone: String(form.get("phone") || ""),
            address: String(form.get("address") || ""),
            occupation: String(form.get("occupation") || ""),
          }).then((saved) => {
            onSaved(saved);
            setMessage("Profile saved.");
          }).catch((reason) => setMessage(apiErrorMessage(reason)));
        }}
      >
        <label>First name<input name="first_name" defaultValue={profile.first_name} /></label>
        <label>Last name<input name="last_name" defaultValue={profile.last_name} /></label>
        <label>Email<input value={profile.email} readOnly /></label>
        <label>Mobile<input name="phone" defaultValue={profile.phone} /></label>
        <label>Address<textarea name="address" defaultValue={profile.address} /></label>
        <label>Occupation<input name="occupation" defaultValue={profile.occupation} /></label>
        <button className="primary-button" type="submit">Save profile</button>
        {message && <p>{message}</p>}
      </form>
    </DashboardPanel>
  );
}

function PasswordSettings() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <DashboardPanel title="Settings" subtitle="Change the password for this parent account.">
      <form
        className="pd-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          users.changePassword({
            current_password: String(form.get("current_password") || ""),
            password: String(form.get("password") || ""),
          }).then((result) => setMessage(result.detail))
            .catch((reason) => setMessage(apiErrorMessage(reason)));
        }}
      >
        <label>Current password<input name="current_password" type="password" required /></label>
        <label>New password<input name="password" type="password" minLength={8} required /></label>
        <button className="primary-button" type="submit">Update password</button>
        {message && <p>{message}</p>}
      </form>
    </DashboardPanel>
  );
}
