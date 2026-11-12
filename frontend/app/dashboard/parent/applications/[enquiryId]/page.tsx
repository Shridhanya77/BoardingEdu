"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { DashboardShell, DashboardState } from "@/components/dashboard/DashboardShell";
import { AdmissionProgress, applicationStatusClass } from "@/components/parent-dashboard/ParentDashboard";
import { apiErrorMessage, parentApplications, type ParentApplication } from "@/lib/api";

const DOCUMENT_TYPES = [
  ["BIRTH_CERTIFICATE", "Birth certificate"],
  ["REPORT_CARD", "Report card"],
  ["TRANSFER_CERTIFICATE", "Transfer certificate"],
  ["PHOTOGRAPH", "Photograph"],
  ["IDENTITY", "Identity document"],
  ["OTHER", "Other"],
];

export default function ParentApplicationPage() {
  const params = useParams<{ enquiryId: string }>();
  const [application, setApplication] = useState<ParentApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    parentApplications.detail(params.enquiryId)
      .then(setApplication)
      .catch((reason) => setError(apiErrorMessage(reason)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // The enquiry id comes from the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.enquiryId]);

  const latestEvent = application?.timeline?.slice(-1)[0];

  return (
    <DashboardShell
      roles={["PARENT"]}
      eyebrow="APPLICATION"
      title={application?.school.school_name || "Application details"}
      subtitle={application ? `${application.enquiry_code} · ${application.application_status_label}` : "Loading this application."}
    >
      <p><Link className="dash-link" href="/dashboard/parent/?section=applications">Back to my applications</Link></p>
      <DashboardState loading={loading} error={error} onRetry={load} />
      {application && (
        <div className="pd-detail">
          <section>
            <h2>School</h2>
            <p>{application.school.address}</p>
            <p>{[application.school.city_name, application.school.state_name].filter(Boolean).join(", ")}</p>
            {application.school.phone && <p>Phone: <a href={`tel:${application.school.phone}`}>{application.school.phone}</a></p>}
            {application.school.email && <p>Email: <a href={`mailto:${application.school.email}`}>{application.school.email}</a></p>}
            {application.school.website && <p>Website: <a href={application.school.website}>{application.school.website}</a></p>}
          </section>
          <section>
            <h2>Student</h2>
            <p>{application.student?.name || "—"}</p>
            <p>Requested class: {application.grade_name || "—"}</p>
            <p>Current class: {application.student?.current_grade || "—"}</p>
            <p>Academic session: {application.academic_year || "—"}</p>
            <p>Submitted: {new Date(application.created_at).toLocaleString("en-IN")}</p>
            <p>Last updated: {new Date(application.updated_at).toLocaleString("en-IN")}</p>
            <p className={`pd-badge pd-badge--${applicationStatusClass(application.application_status)}`}>
              {application.application_status_label}
            </p>
          </section>
          <section>
            <h2>Admission progress</h2>
            <AdmissionProgress status={application.application_status} />
            {application.application_status === "DOCUMENTS_REQUIRED" && (
              <p className="pd-document-request">
                <strong>Action needed:</strong> {latestEvent?.instructions || latestEvent?.remarks || "The school has requested additional documents."}
              </p>
            )}
          </section>
          <section>
            <h2>Timeline</h2>
            <ol className="pd-timeline">
              {(application.timeline ?? []).map((event) => (
                <li key={event.event_id}>
                  <strong>{event.status_label}</strong>
                  <time>{new Date(event.created_at).toLocaleString("en-IN")}</time>
                  {event.remarks && <p>{event.remarks}</p>}
                  {event.instructions && <p>{event.instructions}</p>}
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h2>Documents</h2>
            {application.documents?.length ? (
              <ul className="pd-documents">
                {application.documents.map((document) => (
                  <li key={document.document_id}>
                    <FileText size={18} aria-hidden />
                    <strong>{document.document_type_label}</strong>
                    <span>{document.original_name}</span>
                    <em className={`pd-badge pd-badge--${document.review_status.toLowerCase()}`}>
                      {document.review_status.replace("_", " ")}
                    </em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash-empty">No documents uploaded for this application yet.</p>
            )}
            <form
              className="pd-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const file = data.get("file");
                if (!(file instanceof File) || !file.name) return;
                if (file.size > 5 * 1024 * 1024) {
                  setError("Documents must be 5 MB or smaller.");
                  return;
                }
                parentApplications.uploadDocument(application.enquiry_id, String(data.get("document_type")), file)
                  .then(() => { form.reset(); load(); })
                  .catch((reason) => setError(apiErrorMessage(reason)));
              }}
            >
              <label>
                Document type
                <select name="document_type">
                  {DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>File<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" required /></label>
              <button className="primary-button" type="submit">Upload document</button>
            </form>
          </section>
          <section>
            <h2>Messages</h2>
            <ul className="pd-list">
              {(application.messages ?? []).map((message) => (
                <li key={message.message_id}>
                  <strong>{message.author_name}</strong>
                  <span>{message.body}</span>
                  <time>{new Date(message.created_at).toLocaleString("en-IN")}</time>
                </li>
              ))}
            </ul>
            <form
              className="pd-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const body = String(new FormData(form).get("body") || "");
                parentApplications.sendMessage(application.enquiry_id, body)
                  .then(() => { form.reset(); load(); })
                  .catch((reason) => setError(apiErrorMessage(reason)));
              }}
            >
              <label>Reply<textarea name="body" required maxLength={2000} /></label>
              <button className="primary-button" type="submit">Send</button>
            </form>
          </section>
          {application.application_status !== "WITHDRAWN" && application.application_status !== "REJECTED" && application.application_status !== "ACCEPTED" && (
            <button
              className="dash-link dash-link--button"
              type="button"
              onClick={() => {
                parentApplications.withdraw(application.enquiry_id, "Withdrawn by the parent.")
                  .then(setApplication)
                  .catch((reason) => setError(apiErrorMessage(reason)));
              }}
            >
              Withdraw application
            </button>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
