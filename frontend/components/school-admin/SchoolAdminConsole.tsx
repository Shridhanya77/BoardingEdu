"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BedDouble,
  Building2,
  Bus,
  ClipboardCheck,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  Images,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
  Utensils,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  apiErrorMessage,
  dashboards,
  schools,
  subscriptions,
  type CompletionSection,
  type ApplicationStatus,
  type EnquiryStatus,
  type SchoolDashboardData,
  type SchoolGradeRecord,
  type SchoolPortalUpdate,
} from "@/lib/api";
import { isValidEmailAddress, normalizePhoneNumber } from "@/lib/contact-validation";
import { useDashboardData } from "@/components/dashboard/DashboardShell";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Enquiry submitted",
  RECEIVED: "Application received",
  UNDER_REVIEW: "Under review",
  DOCUMENTS_REQUIRED: "Documents required",
  INTERACTION_SCHEDULED: "Interaction scheduled",
  INTERACTION_COMPLETED: "Interaction completed",
  OFFERED: "Admission offered",
  ACCEPTED: "Admission accepted",
  REJECTED: "Admission rejected",
  WITHDRAWN: "Withdrawn",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  CALL_BACK: "Follow-up",
  CONVERTED: "Converted",
  CLOSED_LOST: "Closed",
  SPAM: "Spam",
};

const CAMPUS_GROUPS = [
  { key: "ACADEMIC", label: "Classrooms & laboratories", hint: "Add each classroom, laboratory, or academic space. Use quantity for capacity.", Icon: FlaskConical },
  { key: "SPORTS", label: "Sports", hint: "Indoor sports, outdoor sports, grounds, and courts.", Icon: Dumbbell },
  { key: "ACCOMMODATION", label: "Hostel", hint: "Hostel capacity only. Do not record which student is in which room.", Icon: BedDouble },
  { key: "DINING", label: "Dining", hint: "Dining halls, seating, and meal arrangements.", Icon: Utensils },
  { key: "HEALTH", label: "Healthcare", hint: "Medical room and staff availability. Do not enter private medical records.", Icon: ShieldCheck },
  { key: "SAFETY", label: "Safety", hint: "Facilities parents should know about. Do not publish internal security procedures.", Icon: ShieldCheck },
  { key: "TRANSPORT", label: "Transport", hint: "Vehicles and routes. Do not enter student assignments or driver personal details.", Icon: Bus },
  { key: "TECHNOLOGY", label: "Student services", hint: "Library, Wi-Fi, counselling, laundry, and other campus services.", Icon: Building2 },
] as const;

type SectionId =
  | "overview"
  | "completion"
  | "profile"
  | "academics"
  | "campus"
  | "fees"
  | "gallery"
  | "enquiries"
  | "plans"
  | "subscription"
  | "payments"
  | "account";

const NAV: { id: SectionId; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Dashboard", Icon: LayoutDashboard },
  { id: "completion", label: "Profile completion", Icon: ClipboardCheck },
  { id: "profile", label: "School profile", Icon: Building2 },
  { id: "academics", label: "Academics", Icon: GraduationCap },
  { id: "campus", label: "Campus", Icon: FlaskConical },
  { id: "fees", label: "Fees & admissions", Icon: IndianRupee },
  { id: "gallery", label: "Photographs", Icon: Images },
  { id: "enquiries", label: "Admission leads", Icon: Mail },
  { id: "plans", label: "Subscription plans", Icon: IndianRupee },
  { id: "subscription", label: "My subscription", Icon: ShieldCheck },
  { id: "payments", label: "Payment history", Icon: ClipboardCheck },
  { id: "account", label: "Account settings", Icon: UserRound },
];

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "awaiting_approval") return "Awaiting approval";
  if (status === "needs_correction") return "Needs correction";
  if (status === "optional") return "Optional";
  return "Missing";
}

export default function SchoolAdminConsole() {
  const { status, user, logout } = useAuth();
  const { data, loading, error, reload } = useDashboardData(dashboards.school);
  const [section, setSection] = useState<SectionId>("overview");
  const [campusGroup, setCampusGroup] = useState<string>("ACADEMIC");
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "guest") {
      window.location.assign("/login/?next=/dashboard/school/");
    }
  }, [status]);

  if (status !== "authenticated" || !user) {
    return (
      <main className="sa-app">
        <p className="sa-state"><Loader2 className="spin" size={18} /> Checking your session…</p>
      </main>
    );
  }

  if (user.role !== "SCHOOL_ADMIN") {
    return (
      <main className="sa-app">
        <p className="sa-state">This panel is for school administrators.</p>
      </main>
    );
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      reload();
    } catch (reason) {
      setFormError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const school = data?.school;
  const publicHref = school
    ? schoolProfilePathFromSlugs({
        countrySlug: school.country_slug,
        stateSlug: school.state_slug,
        citySlug: school.city_slug,
        schoolSlug: school.slug,
        schoolName: school.school_name,
        schoolTypes: school.school_types_detail,
      })
    : "/";

  return (
    <main className="sa-app">
      <aside className="sa-sidebar">
        <div className="sa-brand">
          <strong>BoardingEdu</strong>
          <span>School admin</span>
        </div>
        <nav aria-label="School administration">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? "is-active" : ""}
              onClick={() => {
                setSection(item.id);
                setNotice(null);
                setFormError(null);
              }}
            >
              <item.Icon size={16} aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sa-sidebar__foot">
          <span>{user.first_name || user.username}</span>
          <button type="button" onClick={() => logout()}>
            <LogOut size={14} aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      <section className="sa-main">
        <header className="sa-top">
          <div>
            <p className="sa-kicker">{data?.academic_year || "School workspace"}</p>
            <h1>{school?.school_name ?? "Your school"}</h1>
            <p>
              {school ? `${school.city_name}, ${school.state_name}` : "Manage the information parents see."}
              {school?.school_code ? ` · ${school.school_code}` : ""}
            </p>
          </div>
          {school && (
            <div className="sa-top__meta">
              <span className={`sa-badge sa-badge--${school.verification_status.toLowerCase()}`}>
                {school.verification_status === "VERIFIED"
                  ? "Verified"
                  : school.verification_status === "PENDING"
                    ? "Awaiting approval"
                    : "Needs correction"}
              </span>
              <strong>{school.profile_completeness}% complete</strong>
              {school.verification_status === "VERIFIED" && (
                <Link href={publicHref}>View public profile</Link>
              )}
            </div>
          )}
        </header>

        {loading && <p className="sa-state"><Loader2 className="spin" size={18} /> Loading your school…</p>}
        {error && (
          <p className="sa-state sa-state--error" role="alert">
            {error} <button type="button" onClick={reload}>Try again</button>
          </p>
        )}
        {notice && <p className="sa-banner" role="status">{notice}</p>}
        {formError && <p className="sa-banner sa-banner--error" role="alert">{formError}</p>}
        {data?.school.pending_profile_change && (
          <p className="sa-banner" role="status">
            Profile changes are awaiting BoardingEdu review. The approved public profile remains live until they are approved.
          </p>
        )}

        {data && section === "overview" && (
          <Overview
            data={data}
            onOpen={(next, group) => {
              setSection(next);
              if (group) setCampusGroup(group);
            }}
          />
        )}
        {data && section === "completion" && (
          <CompletionCentre
            data={data}
            onOpen={(next, group) => {
              setSection(next);
              if (group) setCampusGroup(group);
            }}
          />
        )}
        {data && section === "profile" && (
          <ProfileEditor data={data} busy={busy} onSave={(payload) => run(() => schools.updateMine(payload).then(() => undefined), "School profile changes submitted for admin review.")} />
        )}
        {data && section === "academics" && (
          <AcademicsEditor
            data={data}
            busy={busy}
            onAddGrade={(grade, seats) => run(() => dashboards.saveGrade({ grade, seats_available: seats }).then(() => undefined), "Grade added.")}
            onUpdateGrade={(id, seats) => run(() => dashboards.updateGrade(id, { seats_available: seats }).then(() => undefined), "Seat count updated.")}
            onRemoveGrade={(id) => {
              if (!window.confirm("Remove this grade from the school?")) return;
              void run(() => dashboards.removeGrade(id).then(() => undefined), "Grade removed.");
            }}
          />
        )}
        {data && section === "campus" && (
          <CampusEditor
            data={data}
            group={campusGroup}
            busy={busy}
            onGroup={setCampusGroup}
            onSave={(payload) => run(() => dashboards.saveFacility(payload).then(() => undefined), "Facility saved for this school.")}
            onRemove={(id) => {
              if (!window.confirm("Remove this facility from the school profile?")) return;
              void run(() => dashboards.removeFacility(id).then(() => undefined), "Facility removed.");
            }}
          />
        )}
        {data && section === "fees" && (
          <FeesEditor
            data={data}
            busy={busy}
            onAdd={(payload) => run(() => dashboards.saveFeeItem(payload).then(() => undefined), "Fee saved. It stays unpublished until you publish the structure.")}
            onAmount={(id, amount) => run(() => dashboards.updateFeeItem(id, { amount }).then(() => undefined), "Fee amount updated.")}
            onPublish={(id, published) => {
              const message = published
                ? "Publish these fees on the public school profile?"
                : "Hide these fees from the public school profile?";
              if (!window.confirm(message)) return;
              void run(() => dashboards.publishFees(id, published).then(() => undefined), published ? "Fees published." : "Fees unpublished.");
            }}
          />
        )}
        {data && section === "gallery" && (
          <GalleryEditor
            data={data}
            busy={busy}
            onSaveProfile={(payload) => run(() => schools.updateMine(payload).then(() => undefined), "Logo and cover changes submitted for admin review.")}
            onAddUrl={(payload) => run(() => dashboards.savePhoto(payload).then(() => undefined), "Photograph added.")}
            onUpload={(file, category, caption) => run(() => dashboards.uploadPhoto(file, category, caption).then(() => undefined), "Photograph uploaded.")}
            onRemove={(id) => {
              if (!window.confirm("Remove this photograph from the school gallery?")) return;
              void run(() => dashboards.removePhoto(id).then(() => undefined), "Photograph removed.");
            }}
          />
        )}
        {data && section === "enquiries" && (
          <EnquiryBoard
            data={data}
            busy={busy}
            onUpgrade={() => setSection("plans")}
            onStatus={(id, next) => run(() => dashboards.updateEnquiryStatus(id, next).then(() => undefined), "Enquiry status updated.")}
            onApplication={(id, payload) => run(() => dashboards.updateApplicationStatus(id, payload).then(() => undefined), "Parent application status updated.")}
          />
        )}
        {data && section === "plans" && (
          <PlanList onPurchased={() => { setSection("subscription"); reload(); }} />
        )}
        {data && (section === "subscription" || section === "payments") && (
          <SubscriptionAccount mode={section} onUpgrade={() => setSection("plans")} />
        )}
        {section === "account" && <AccountSettings />}
      </section>
    </main>
  );
}

function Overview({
  data,
  onOpen,
}: {
  data: SchoolDashboardData;
  onOpen: (section: SectionId, group?: string) => void;
}) {
  const maxEnquiry = Math.max(1, ...Object.values(data.enquiry_status));
  const tasks = data.completion.sections
    .flatMap((section) => section.items.filter((item) => item.status === "missing").map((item) => ({ ...item, section: section.key })))
    .slice(0, 6);

  return (
    <div className="sa-grid">
      <div className="sa-kpis">
        <Kpi label="Admission enquiries" value={data.stats.enquiries_total} hint={`${data.stats.enquiries_new} new`} tone="blue" />
        <Kpi label="This month" value={data.stats.enquiries_this_month} hint={`${data.stats.enquiries_converted} converted`} tone="gold" />
        <Kpi label="Classrooms recorded" value={data.metrics.classrooms} hint={`${data.metrics.laboratories} laboratories`} />
        <Kpi label="Sports facilities" value={data.metrics.sports_facilities} hint={`${data.metrics.academic_facilities} academic facilities`} />
        <Kpi label="Hostel capacity" value={data.metrics.hostel_capacity} hint="From accommodation facilities" />
        <Kpi label="Photographs" value={data.metrics.photographs} hint={`${data.stats.reviews_published} published reviews`} />
      </div>

      <div className="sa-split">
        <article className="sa-card">
          <header><h2>Enquiries</h2><button type="button" onClick={() => onOpen("enquiries")}>Open</button></header>
          {data.panel_access === "pending" ? (
            <p>Enquiry details open after BoardingEdu verifies the school. You can still complete the profile now.</p>
          ) : (
            <div className="sa-bars" aria-label="Enquiries by status">
              {Object.entries(data.enquiry_status).map(([code, count]) => (
                <div key={code}>
                  <span>{STATUS_LABELS[code] ?? code}</span>
                  <div><i style={{ width: `${Math.max(4, (count / maxEnquiry) * 100)}%` }} /></div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="sa-card sa-card--score">
          <header><h2>Profile completion</h2><button type="button" onClick={() => onOpen("completion")}>Review</button></header>
          <div className="sa-donut" style={{ ["--score" as string]: `${data.completion.score * 3.6}deg` }}>
            <strong>{data.completion.score}%</strong>
          </div>
          <ul className="sa-score-legend">
            <li><span>Missing</span><strong>{data.completion.summary.missing}</strong></li>
            <li><span>Awaiting approval</span><strong>{data.completion.summary.awaiting_approval}</strong></li>
            <li><span>Needs correction</span><strong>{data.completion.summary.needs_correction}</strong></li>
            <li><span>Published</span><strong>{data.completion.summary.published}</strong></li>
          </ul>
        </article>
      </div>

      <div className="sa-split">
        <article className="sa-card">
          <header><h2>What still needs attention</h2></header>
          {tasks.length === 0 ? <p>Required profile sections are filled in.</p> : (
            <ul className="sa-tasks">
              {tasks.map((task) => (
                <li key={`${task.section}-${task.key}`}>
                  <div>
                    <strong>{task.label}</strong>
                    <span>{task.detail}</span>
                  </div>
                  <button type="button" onClick={() => onOpen(destination(task.section), campusKey(task.section))}>Fix</button>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="sa-card">
          <header><h2>Quick actions</h2></header>
          <div className="sa-actions">
            <button type="button" onClick={() => onOpen("profile")}>Edit school profile</button>
            <button type="button" onClick={() => onOpen("campus", "ACADEMIC")}>Add classroom or lab</button>
            <button type="button" onClick={() => onOpen("campus", "SPORTS")}>Add sports facility</button>
            <button type="button" onClick={() => onOpen("fees")}>Update fees</button>
            <button type="button" onClick={() => onOpen("gallery")}>Upload photographs</button>
            <button type="button" onClick={() => onOpen("campus", "ACCOMMODATION")}>Manage hostel</button>
            <button type="button" onClick={() => onOpen("campus", "DINING")}>Manage meals</button>
            <button type="button" onClick={() => onOpen("enquiries")}>View enquiries</button>
          </div>
        </article>
      </div>
    </div>
  );
}

function CompletionCentre({
  data,
  onOpen,
}: {
  data: SchoolDashboardData;
  onOpen: (section: SectionId, group?: string) => void;
}) {
  return (
    <div className="sa-stack">
      <article className="sa-card">
        <header>
          <h2>Profile completion & verification</h2>
        </header>
        <p>
          {data.school.verification_status === "VERIFIED"
            ? "Filled sections are on the public profile. Empty sections are missing, not marked unavailable."
            : data.school.verification_status === "PENDING"
              ? "Your changes are saved. They become public after BoardingEdu approves the school."
              : "Finish the missing sections. The school stays off the public site until BoardingEdu approves it."}
        </p>
      </article>
      {data.completion.sections.map((section) => (
        <SectionCard key={section.key} section={section} onOpen={onOpen} />
      ))}
    </div>
  );
}

function SectionCard({
  section,
  onOpen,
}: {
  section: CompletionSection;
  onOpen: (section: SectionId, group?: string) => void;
}) {
  return (
    <article className="sa-card">
      <header>
        <h2>{section.label}</h2>
        <span className={`sa-pill sa-pill--${section.status}`}>{section.score}% · {statusLabel(section.status)}</span>
      </header>
      <ul className="sa-check">
        {section.items.map((item) => (
          <li key={item.key} className={`is-${item.status}`}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
            <em>{statusLabel(item.status)}</em>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onOpen(destination(section.key), campusKey(section.key))}>
        Open this section
      </button>
    </article>
  );
}

function ProfileEditor({
  data,
  busy,
  onSave,
}: {
  data: SchoolDashboardData;
  busy: boolean;
  onSave: (payload: SchoolPortalUpdate) => void;
}) {
  const school = data.school;
  const [draft, setDraft] = useState({
    short_name: school.short_name,
    tagline: school.tagline,
    about: school.about,
    website: school.website,
    phone: school.phone,
    email: school.email,
    principal_name: school.principal_name,
    address: school.address,
    pincode: school.pincode,
    established_year: school.established_year ? String(school.established_year) : "",
    school_logo_url: school.school_logo_url,
    school_image_url: school.school_image_url,
    admission_open: school.admission_open,
    gender: school.gender,
    boards: school.boards,
    school_types: school.school_type_ids,
  });

  const [localError, setLocalError] = useState<string | null>(null);

  function save(event: FormEvent) {
    event.preventDefault();
    if (draft.email && !isValidEmailAddress(draft.email)) {
      setLocalError("Enter a valid school email address.");
      return;
    }
    const phone = draft.phone.trim() ? normalizePhoneNumber(draft.phone) : "";
    if (phone === null) {
      setLocalError("Enter the school country code followed by exactly 10 phone number digits.");
      return;
    }
    if (draft.boards.length === 0 || draft.school_types.length === 0) {
      setLocalError("Choose at least one school type and one education board.");
      return;
    }
    setLocalError(null);
    onSave({
      short_name: draft.short_name,
      tagline: draft.tagline,
      about: draft.about,
      website: draft.website,
      phone,
      email: draft.email.trim(),
      principal_name: draft.principal_name,
      address: draft.address,
      pincode: draft.pincode,
      established_year: draft.established_year ? Number(draft.established_year) : null,
      school_logo_url: draft.school_logo_url,
      school_image_url: draft.school_image_url,
      admission_open: draft.admission_open,
      gender: draft.gender,
      boards: draft.boards,
      school_types: draft.school_types,
    });
  }

  return (
    <form className="sa-card sa-form" onSubmit={save}>
      <header><h2>School profile</h2></header>
      <p>School name and code stay with BoardingEdu. Save this section before leaving it. Empty fields stay missing — they are not marked unavailable.</p>
      {localError && <p className="sa-banner sa-banner--error" role="alert">{localError}</p>}
      <div className="sa-form-grid">
        <label>Short name<input value={draft.short_name} onChange={(event) => setDraft({ ...draft, short_name: event.target.value })} /></label>
        <label>Year established<input inputMode="numeric" value={draft.established_year} onChange={(event) => setDraft({ ...draft, established_year: event.target.value })} /></label>
        <label className="sa-span">Tagline<input value={draft.tagline} maxLength={200} onChange={(event) => setDraft({ ...draft, tagline: event.target.value })} /></label>
        <label className="sa-span">Description<textarea rows={5} value={draft.about} onChange={(event) => setDraft({ ...draft, about: event.target.value })} /></label>
        <label>Phone<input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="+91 98765 43210" /></label>
        <label>Email<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
        <label>Website<input value={draft.website} onChange={(event) => setDraft({ ...draft, website: event.target.value })} /></label>
        <label>Principal<input value={draft.principal_name} onChange={(event) => setDraft({ ...draft, principal_name: event.target.value })} /></label>
        <label className="sa-span">Address<input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
        <label>Postal code<input value={draft.pincode} onChange={(event) => setDraft({ ...draft, pincode: event.target.value })} /></label>
        <label>Admissions
          <select value={draft.admission_open ? "open" : "closed"} onChange={(event) => setDraft({ ...draft, admission_open: event.target.value === "open" })}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <fieldset className="sa-span">
          <legend>Gender</legend>
          {[["COED", "Co-ed"], ["BOYS", "Boys"], ["GIRLS", "Girls"]].map(([value, label]) => (
            <label key={value} className="sa-checkline">
              <input type="radio" name="gender" checked={draft.gender === value} onChange={() => setDraft({ ...draft, gender: value })} />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>School type</legend>
          {data.catalog.school_types.map((item) => (
            <label key={item.school_type_id} className="sa-checkline">
              <input
                type="checkbox"
                checked={draft.school_types.includes(item.school_type_id)}
                onChange={() => setDraft({
                  ...draft,
                  school_types: toggle(draft.school_types, item.school_type_id),
                })}
              />
              {item.type_name}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Education boards</legend>
          {data.catalog.boards.map((item) => (
            <label key={item.board_id} className="sa-checkline">
              <input
                type="checkbox"
                checked={draft.boards.includes(item.board_id)}
                onChange={() => setDraft({ ...draft, boards: toggle(draft.boards, item.board_id) })}
              />
              {item.board_name}
            </label>
          ))}
        </fieldset>
      </div>
      <button className="sa-primary" type="submit" disabled={busy}>Save profile</button>
    </form>
  );
}

function AcademicsEditor({
  data,
  busy,
  onAddGrade,
  onUpdateGrade,
  onRemoveGrade,
}: {
  data: SchoolDashboardData;
  busy: boolean;
  onAddGrade: (grade: string, seats: number | null) => void;
  onUpdateGrade: (id: string, seats: number | null) => void;
  onRemoveGrade: (id: string) => void;
}) {
  const [grade, setGrade] = useState(data.catalog.grades[0]?.grade_id ?? "");
  const [seats, setSeats] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<string | null>(null);
  const offered = new Set(data.grades.map((row) => row.grade));

  function draftFor(row: SchoolGradeRecord) {
    return drafts[row.school_grade_id] ?? (row.seats_available === null ? "" : String(row.seats_available));
  }

  function commitSeats(row: SchoolGradeRecord) {
    const raw = draftFor(row).trim();
    if (raw === "") {
      setRowError(null);
      onUpdateGrade(row.school_grade_id, null);
      return;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      setRowError("Seats must be a whole number of 0 or more. Leave the field blank if they are not decided yet.");
      return;
    }
    setRowError(null);
    onUpdateGrade(row.school_grade_id, value);
  }

  return (
    <div className="sa-stack">
      <article className="sa-card">
        <header><h2>Grades offered</h2></header>
        <p>Seats are the intake for each class. Leave a seat count blank if it is not decided yet, then save the row.</p>
        <form
          className="sa-inline"
          onSubmit={(event) => {
            event.preventDefault();
            if (!grade) return;
            onAddGrade(grade, seats ? Number(seats) : null);
            setSeats("");
          }}
        >
          <select value={grade} onChange={(event) => setGrade(event.target.value)}>
            {data.catalog.grades.map((item) => (
              <option key={item.grade_id} value={item.grade_id}>{item.grade_name}</option>
            ))}
          </select>
          <input inputMode="numeric" placeholder="Seats" value={seats} onChange={(event) => setSeats(event.target.value)} />
          <button className="sa-primary" type="submit" disabled={busy || offered.has(grade)}>Add grade</button>
        </form>
        {rowError && <p className="sa-banner sa-banner--error" role="alert">{rowError}</p>}
        <table className="sa-table">
          <thead><tr><th>Grade</th><th>Seats</th><th /></tr></thead>
          <tbody>
            {data.grades.length === 0 && <tr><td colSpan={3}>No grades recorded yet.</td></tr>}
            {data.grades.map((row) => (
              <tr key={row.school_grade_id}>
                <td>{row.grade_name}</td>
                <td>
                  <input
                    className="sa-seat"
                    inputMode="numeric"
                    placeholder="—"
                    aria-label={`Seats for ${row.grade_name}`}
                    value={draftFor(row)}
                    onChange={(event) => setDrafts({ ...drafts, [row.school_grade_id]: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitSeats(row);
                      }
                    }}
                  />
                </td>
                <td className="sa-table__actions">
                  <button type="button" className="sa-mini sa-mini--go" disabled={busy} onClick={() => commitSeats(row)}>Save</button>
                  <button type="button" className="sa-mini" disabled={busy} onClick={() => onRemoveGrade(row.school_grade_id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <article className="sa-card">
        <header><h2>Boards on this profile</h2></header>
        <p>Change boards and school type from School profile. The grades above are the classes this school admits.</p>
      </article>
    </div>
  );
}

function CampusEditor({
  data,
  group,
  busy,
  onGroup,
  onSave,
  onRemove,
}: {
  data: SchoolDashboardData;
  group: string;
  busy: boolean;
  onGroup: (group: string) => void;
  onSave: (payload: { facility: string; quantity_or_capacity: number | null; description: string; available: boolean }) => void;
  onRemove: (id: string) => void;
}) {
  const choices = data.catalog.facilities.filter((item) => item.category === group);
  const rows = data.facilities.filter((item) => item.category === group);
  const current = CAMPUS_GROUPS.find((item) => item.key === group) ?? CAMPUS_GROUPS[0];

  return (
    <div className="sa-stack">
      <div className="sa-pills" role="tablist">
        {CAMPUS_GROUPS.map((item) => (
          <button key={item.key} type="button" className={group === item.key ? "is-active" : ""} onClick={() => onGroup(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      <article className="sa-card">
        <header><h2>{current.label}</h2></header>
        <p>{current.hint}</p>
        {choices.length === 0 ? (
          <p>No {current.label.toLowerCase()} options are in the master list yet. A platform admin can add them in Django admin.</p>
        ) : (
          <ul className="sa-yesno">
            {choices.map((item) => {
              const saved = rows.find((row) => row.facility === item.facility_id && row.available);
              return (
                <li key={item.facility_id}>
                  <span>{item.facility_name}</span>
                  <div>
                    <button
                      type="button"
                      className={saved ? "is-yes" : ""}
                      disabled={busy}
                      onClick={() => {
                        if (saved) return;
                        onSave({ facility: item.facility_id, quantity_or_capacity: null, description: "", available: true });
                      }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={saved ? "" : "is-no"}
                      disabled={busy}
                      onClick={() => {
                        if (saved) onRemove(saved.school_facility_id);
                      }}
                    >
                      No
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}

function FeesEditor({
  data,
  busy,
  onAdd,
  onAmount,
  onPublish,
}: {
  data: SchoolDashboardData;
  busy: boolean;
  onAdd: (payload: { fee_structure?: string; item_name: string; item_category: string; payment_frequency: string; amount: string; grade?: string }) => void;
  onAmount: (id: string, amount: string) => void;
  onPublish: (id: string, published: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(data.catalog.fee_categories[0]?.value ?? "TUITION");
  const [frequency, setFrequency] = useState("ANNUAL");
  const [amount, setAmount] = useState("");
  const [grade, setGrade] = useState("");
  const structureId = data.fees[0]?.fee_structure_id;

  return (
    <div className="sa-stack">
      <article className="sa-card">
        <header><h2>Add a fee</h2></header>
        <p>New structures stay unpublished until you choose to publish them. Published amounts are what parents see.</p>
        <form
          className="sa-inline"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd({
              fee_structure: structureId,
              item_name: name,
              item_category: category,
              payment_frequency: frequency,
              amount,
              grade: grade || undefined,
            });
            setName("");
            setAmount("");
          }}
        >
          <input placeholder="Fee name" value={name} onChange={(event) => setName(event.target.value)} required />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {data.catalog.fee_categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            {data.catalog.fee_frequencies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={grade} onChange={(event) => setGrade(event.target.value)}>
            <option value="">All grades</option>
            {data.catalog.grades.map((item) => <option key={item.grade_id} value={item.grade_id}>{item.grade_name}</option>)}
          </select>
          <input inputMode="decimal" placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          <button className="sa-primary" type="submit" disabled={busy}>Add fee</button>
        </form>
      </article>
      {data.fees.length === 0 && <article className="sa-card"><p>No fee structure yet. Adding a fee creates one for the current academic year.</p></article>}
      {data.fees.map((structure) => (
        <article className="sa-card" key={structure.fee_structure_id}>
          <header>
            <h2>{structure.year_code} · {structure.structure_name}</h2>
            <button type="button" onClick={() => onPublish(structure.fee_structure_id, !structure.published)}>
              {structure.published ? "Unpublish" : "Publish"}
            </button>
          </header>
          <table className="sa-table">
            <thead><tr><th>Fee</th><th>Grade</th><th>Amount</th><th /></tr></thead>
            <tbody>
              {structure.items.map((item) => (
                <FeeRow key={item.fee_item_id} item={item} busy={busy} onAmount={onAmount} />
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </div>
  );
}

function FeeRow({
  item,
  busy,
  onAmount,
}: {
  item: SchoolDashboardData["fees"][number]["items"][number];
  busy: boolean;
  onAmount: (id: string, amount: string) => void;
}) {
  const [amount, setAmount] = useState(item.amount ?? "");
  return (
    <tr>
      <td>{item.item_name}<span className="sa-muted">{item.item_category}</span></td>
      <td>{item.grade_name}</td>
      <td><input value={amount} onChange={(event) => setAmount(event.target.value)} /></td>
      <td><button type="button" disabled={busy} onClick={() => onAmount(item.fee_item_id, amount)}>Save</button></td>
    </tr>
  );
}

function GalleryEditor({
  data,
  busy,
  onSaveProfile,
  onAddUrl,
  onUpload,
  onRemove,
}: {
  data: SchoolDashboardData;
  busy: boolean;
  onSaveProfile: (payload: SchoolPortalUpdate) => void;
  onAddUrl: (payload: { photo_url: string; caption: string; category: string }) => void;
  onUpload: (file: File, category: string, caption: string) => void;
  onRemove: (id: string) => void;
}) {
  const [logo, setLogo] = useState(data.school.school_logo_url);
  const [cover, setCover] = useState(data.school.school_image_url);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState(data.catalog.photo_categories[0]?.value ?? "CAMPUS");

  return (
    <div className="sa-stack">
      <article className="sa-card">
        <header><h2>Logo and cover</h2></header>
        <div className="sa-form-grid">
          <label>Logo URL<input value={logo} onChange={(event) => setLogo(event.target.value)} /></label>
          <label>Cover URL<input value={cover} onChange={(event) => setCover(event.target.value)} /></label>
        </div>
        <button className="sa-primary" type="button" disabled={busy} onClick={() => onSaveProfile({ ...profilePayload(data), school_logo_url: logo, school_image_url: cover })}>
          Save logo and cover
        </button>
      </article>
      <article className="sa-card">
        <header><h2>Gallery</h2></header>
        <form
          className="sa-inline"
          onSubmit={(event) => {
            event.preventDefault();
            const file = (event.currentTarget.elements.namedItem("image") as HTMLInputElement).files?.[0];
            if (file) onUpload(file, category, caption);
            else if (url) onAddUrl({ photo_url: url, caption, category });
            setUrl("");
            setCaption("");
            event.currentTarget.reset();
          }}
        >
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          <input placeholder="or paste an image URL" value={url} onChange={(event) => setUrl(event.target.value)} />
          <input placeholder="Caption" value={caption} onChange={(event) => setCaption(event.target.value)} />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {data.catalog.photo_categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button className="sa-primary" type="submit" disabled={busy}>Add photograph</button>
        </form>
        <div className="sa-gallery">
          {data.photos.length === 0 && <p>No gallery photographs yet.</p>}
          {data.photos.map((photo) => (
            <figure key={photo.photo_id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.photo_url} alt={photo.alt_text || photo.caption || "School photograph"} />
              <figcaption>
                <span>{photo.caption || photo.category}</span>
                <button type="button" onClick={() => onRemove(photo.photo_id)}>Remove</button>
              </figcaption>
            </figure>
          ))}
        </div>
      </article>
    </div>
  );
}

function EnquiryBoard({
  data,
  busy,
  onStatus,
  onApplication,
  onUpgrade,
}: {
  data: SchoolDashboardData;
  busy: boolean;
  onStatus: (id: string, status: EnquiryStatus) => void;
  onApplication: (id: string, payload: { application_status: ApplicationStatus; remarks?: string; instructions?: string }) => void;
  onUpgrade: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const locked = !data.subscription?.active;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.recent_enquiries.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (!needle) return true;
      return `${row.enquiry_code} ${row.grade_name} ${row.parent_name} ${row.child_name} ${row.parent_email}`.toLowerCase().includes(needle);
    });
  }, [data.recent_enquiries, query, status]);
  const open = rows.find((row) => row.enquiry_id === selected) ?? null;

  return (
    <div className="sa-stack">
      {locked && (
        <article className="sa-card">
          <header><h2>Contacts are locked</h2></header>
          <p>
            {data.subscription?.status === "EXPIRED"
              ? "The subscription has expired. Lead counts stay visible, but parent and student contact details are hidden until you renew."
              : "You can see that enquiries arrived. Parent names, student names, mobile numbers, and email addresses stay hidden until a subscription is active."}
          </p>
          <button className="sa-primary" type="button" onClick={onUpgrade}>
            {data.subscription?.status === "EXPIRED" ? "Renew subscription" : "Unlock leads"}
          </button>
        </article>
      )}
      <div className="sa-kpis">
        <Kpi label="Total leads" value={data.stats.enquiries_total} hint="Received by this school" />
        <Kpi label="New" value={data.enquiry_status.NEW ?? 0} hint="Not yet handled" tone="blue" />
        <Kpi label="Follow-up" value={data.enquiry_status.CALL_BACK ?? 0} hint="Call back scheduled" tone="gold" />
        <Kpi label="Converted" value={data.stats.enquiries_converted} hint="Moved forward" />
        <Kpi label="In progress" value={(data.enquiry_status.IN_PROGRESS ?? 0) + (data.enquiry_status.ASSIGNED ?? 0)} hint="Being contacted" />
        <Kpi label="Closed" value={(data.enquiry_status.CLOSED_LOST ?? 0) + (data.enquiry_status.SPAM ?? 0)} hint="Closed or spam" />
      </div>
      <article className="sa-card">
        <header>
          <h2>Admission leads</h2>
          <input
            placeholder={locked ? "Search by lead code or grade" : "Search name, email, or code"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </header>
        <table className="sa-table">
          <thead>
            <tr><th>Lead</th><th>Date</th><th>Grade</th><th>Session</th><th>Parent</th><th>Contact</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7}>No leads match.</td></tr>}
            {rows.map((row) => (
              <tr key={row.enquiry_id}>
                <td><button type="button" onClick={() => setSelected(row.enquiry_id)}>{row.enquiry_code}</button></td>
                <td>{new Date(row.created_at).toLocaleDateString()}</td>
                <td>{row.grade_name || "—"}</td>
                <td>{row.academic_year || "—"}</td>
                <td>{row.contacts_locked ? "Locked" : row.parent_name || "—"}</td>
                <td>{row.contacts_locked ? "Locked" : row.parent_phone || row.parent_email || "—"}</td>
                <td>
                  <select
                    value={row.status}
                    disabled={busy}
                    onChange={(event) => onStatus(row.enquiry_id, event.target.value as EnquiryStatus)}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      {open && (
        <article className="sa-card">
          <header><h2>Lead {open.enquiry_code}</h2></header>
          {open.contacts_locked ? (
            <p>Personal details are locked. Upgrade the subscription to see the parent, student, mobile number, and email.</p>
          ) : (
            <>
              <p>Parent: {open.parent_name || "—"}</p>
              <p>Student: {open.child_name || "—"}</p>
              <p>Mobile: {open.parent_phone ? <a href={`tel:${open.parent_phone}`}>{open.parent_phone}</a> : "—"}</p>
              <p>Email: {open.parent_email ? <a href={`mailto:${open.parent_email}`}>{open.parent_email}</a> : "—"}</p>
              <p>Message: {open.message || "—"}</p>
            </>
          )}
          <p>Grade: {open.grade_name || "—"} · Session: {open.academic_year || "—"} · Source: {open.source || "—"}</p>
          <form
            className="sa-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              onApplication(open.enquiry_id, {
                application_status: String(form.get("application_status")) as ApplicationStatus,
                remarks: String(form.get("remarks") || ""),
                instructions: String(form.get("instructions") || ""),
              });
            }}
          >
            <label>
              Parent-facing status
              <select name="application_status" defaultValue={open.application_status || "SUBMITTED"}>
                {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Remarks for the parent
              <input name="remarks" placeholder="What should the parent know?" />
            </label>
            <label>
              Instructions
              <input name="instructions" placeholder="Documents, meeting time, or offer details" />
            </label>
            <button className="sa-btn" type="submit" disabled={busy}>Update parent application</button>
          </form>
        </article>
      )}
    </div>
  );
}

function PlanList({ onPurchased }: { onPurchased: () => void }) {
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof subscriptions.plans>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    subscriptions.plans().then(setPlans).catch((reason) => setError(apiErrorMessage(reason)));
  }, []);

  async function buy(planId: string) {
    setBusy(true);
    setError(null);
    try {
      const order = await subscriptions.order(planId);
      await openCheckout(order);
      onPurchased();
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="sa-card">
      <header><h2>Subscription plans</h2></header>
      {error && <p role="alert">{error}</p>}
      {plans.length === 0 && !error && <p>No plans are on sale yet. BoardingEdu adds prices from the platform admin.</p>}
      <div className="sa-kpis">
        {plans.map((plan) => (
          <article key={plan.plan_id} className="sa-kpi">
            <span>{plan.name}</span>
            <strong>{plan.currency} {plan.price}</strong>
            <em>{plan.duration_days} days{plan.lead_quota ? ` · ${plan.lead_quota} leads` : " · all leads"}</em>
            <p>{plan.description}</p>
            <button className="sa-primary" type="button" disabled={busy || !plan.lead_access} onClick={() => buy(plan.plan_id)}>
              {plan.lead_access ? "Purchase" : "No lead access"}
            </button>
          </article>
        ))}
      </div>
    </article>
  );
}

function SubscriptionAccount({ mode, onUpgrade }: { mode: "subscription" | "payments"; onUpgrade: () => void }) {
  const [record, setRecord] = useState<Awaited<ReturnType<typeof subscriptions.mine>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    subscriptions.mine().then(setRecord).catch((reason) => setError(apiErrorMessage(reason)));
  }, []);
  if (error) return <p className="sa-state sa-state--error" role="alert">{error}</p>;
  if (!record) return <p className="sa-state">Loading subscription…</p>;
  if (mode === "payments") {
    return (
      <article className="sa-card">
        <header><h2>Payment history</h2></header>
        <table className="sa-table">
          <thead><tr><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {record.payments.length === 0 && <tr><td colSpan={4}>No payments yet.</td></tr>}
            {record.payments.map((payment) => (
              <tr key={payment.payment_id}>
                <td>{payment.plan_name}</td>
                <td>{payment.currency} {payment.amount}</td>
                <td>{payment.status}</td>
                <td>{new Date(payment.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    );
  }
  const item = record.subscription;
  return (
    <article className="sa-card">
      <header><h2>My subscription</h2></header>
      <p>Status: {item.status === "NONE" ? "No subscription" : item.status}</p>
      <p>Plan: {item.plan_name || "—"}</p>
      <p>Starts: {item.starts_at ? new Date(item.starts_at).toLocaleString() : "—"}</p>
      <p>Expires: {item.expires_at ? new Date(item.expires_at).toLocaleString() : "—"}</p>
      <p>{item.active ? "Lead contact details are available." : "Lead contact details are locked."}</p>
      {!item.active && <button className="sa-primary" type="button" onClick={onUpgrade}>Renew or upgrade</button>}
    </article>
  );
}

function AccountSettings() {
  const { user } = useAuth();
  return (
    <article className="sa-card">
      <header><h2>Account settings</h2></header>
      <p>Username: {user?.username}</p>
      <p>Email: {user?.email || "—"}</p>
      <p>Role: School administrator</p>
    </article>
  );
}

function openCheckout(order: {
  key_id: string;
  provider_order_id: string;
  amount_paise: number;
  currency: string;
  plan: { name: string };
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay]");
    const start = () => {
      const Razorpay = (window as unknown as { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!Razorpay) {
        reject(new Error("The payment window could not be opened."));
        return;
      }
      const checkout = new Razorpay({
        key: order.key_id,
        order_id: order.provider_order_id,
        amount: order.amount_paise,
        currency: order.currency,
        name: "BoardingEdu",
        description: order.plan.name,
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          subscriptions.verify(response).then(() => resolve()).catch(reject);
        },
        modal: { ondismiss: () => reject(new Error("Payment was closed before it finished.")) },
      });
      checkout.open();
    };
    if (existing) {
      start();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.dataset.razorpay = "true";
    script.onload = start;
    script.onerror = () => reject(new Error("The payment window could not be loaded."));
    document.body.appendChild(script);
  });
}

function Kpi({ label, value, hint, tone }: { label: string; value: number; hint: string; tone?: "blue" | "gold" }) {
  return (
    <article className={`sa-kpi${tone ? ` sa-kpi--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{hint}</em>
    </article>
  );
}

function destination(sectionKey: string): SectionId {
  if (sectionKey === "academics") return "academics";
  if (sectionKey === "fees") return "fees";
  if (sectionKey === "gallery") return "gallery";
  if (["campus", "sports", "hostel", "dining", "healthcare", "safety", "transport"].includes(sectionKey)) return "campus";
  if (sectionKey === "publishing") return "completion";
  return "profile";
}

function campusKey(sectionKey: string) {
  return {
    campus: "ACADEMIC",
    sports: "SPORTS",
    hostel: "ACCOMMODATION",
    dining: "DINING",
    healthcare: "HEALTH",
    safety: "SAFETY",
    transport: "TRANSPORT",
  }[sectionKey];
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function profilePayload(data: SchoolDashboardData): SchoolPortalUpdate {
  return {
    short_name: data.school.short_name,
    tagline: data.school.tagline,
    about: data.school.about,
    website: data.school.website,
    phone: data.school.phone,
    email: data.school.email,
    principal_name: data.school.principal_name,
    address: data.school.address,
    pincode: data.school.pincode,
    established_year: data.school.established_year,
    school_logo_url: data.school.school_logo_url,
    school_image_url: data.school.school_image_url,
    admission_open: data.school.admission_open,
    gender: data.school.gender,
    boards: data.school.boards,
    school_types: data.school.school_type_ids,
  };
}
