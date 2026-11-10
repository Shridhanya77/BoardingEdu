"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, FileText, GraduationCap } from "lucide-react";
import {
  DashboardPanel,
  DashboardShell,
  DashboardState,
  StatCard,
  useDashboardData,
} from "@/components/dashboard/DashboardShell";
import {
  apiErrorMessage,
  dashboards,
  parentApplications,
  users,
  type ParentApplication,
  type ParentProfileData,
} from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";

const SECTIONS = [
  ["dashboard", "Dashboard"],
  ["applications", "My Applications"],
  ["students", "My Students"],
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
    if (section === "applications" || section === "documents" || section === "messages") {
      parentApplications.list().then(setApplications).catch((reason) => setLocalError(apiErrorMessage(reason)));
    }
    if (section === "profile") {
      parentApplications.profile().then(setProfile).catch((reason) => setLocalError(apiErrorMessage(reason)));
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
        </>
      )}
      {data && section === "applications" && (
        <ApplicationList applications={applications} fallback={data.recent_enquiries.map((row) => row.enquiry_id)} />
      )}
      {data && section === "students" && (
        <DashboardPanel title="My students" subtitle="Children linked to your admission enquiries.">
          {data.children.length === 0 ? (
            <p className="dash-empty">Add a child when you submit an enquiry from a school page.</p>
          ) : (
            <ul className="dash-cards">
              {data.children.map((child) => (
                <li className="dash-card" key={child.child_id}>
                  <span className="dash-card__icon" aria-hidden><GraduationCap size={18} /></span>
                  <div>
                    <strong>{child.name}</strong>
                    <span>{child.gender}{child.date_of_birth ? ` · ${child.date_of_birth}` : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      )}
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
}: {
  applications: ParentApplication[] | null;
  fallback: string[];
}) {
  const rows = applications;
  return (
    <DashboardPanel title="My applications" subtitle="Each admission enquiry is tracked separately.">
      {!rows && fallback.length === 0 && <p className="dash-empty">You have not applied to a school yet.</p>}
      {rows && rows.length === 0 && <p className="dash-empty">You have not applied to a school yet.</p>}
      <ul className="pd-apps">
        {(rows ?? []).map((application) => (
          <li key={application.enquiry_id}>
            <div>
              <strong>{application.school.school_name}</strong>
              <span>
                {application.enquiry_code}
                {application.grade_name ? ` · ${application.grade_name}` : ""}
                {application.academic_year ? ` · ${application.academic_year}` : ""}
              </span>
              <span>{[application.school.city_name, application.school.state_name].filter(Boolean).join(", ")}</span>
            </div>
            <em className={`pd-badge pd-badge--${applicationStatusClass(application.application_status)}`}>
              {application.application_status_label}
            </em>
            <Link href={`/dashboard/parent/applications/${application.enquiry_id}/`}>View details</Link>
          </li>
        ))}
      </ul>
      {!rows && <p className="dash-empty">Open this section to load your applications.</p>}
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
  return (
    <DashboardPanel title="Documents" subtitle="Files you have uploaded for schools. Pending requests appear on each application.">
      {documents.length === 0 ? (
        <p className="dash-empty">No documents uploaded yet. Open an application when a school asks for a file.</p>
      ) : (
        <ul className="pd-list">
          {documents.map((document) => (
            <li key={document.document_id}>
              <FileText size={16} aria-hidden />
              <strong>{document.document_type_label}</strong>
              <span>{document.school} · {document.review_status}</span>
              <Link href={`/dashboard/parent/applications/${document.enquiry_id}/`}>Open</Link>
            </li>
          ))}
        </ul>
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
