"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { admissions, ApiError, type NewEnquiryInput, type SchoolDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type EnquiryContextValue = { open: () => void };

const SchoolEnquiryContext = createContext<EnquiryContextValue | null>(null);

/** Opens the school enquiry popup from anywhere inside `SchoolEnquiryProvider`. */
export function useSchoolEnquiry() {
  return useContext(SchoolEnquiryContext);
}

type FormState = {
  child_name: string;
  child_gender: "" | "BOY" | "GIRL";
  child_dob: string;
  applying_for_grade_name: string;
  parent_full_name: string;
  parent_email: string;
  parent_phone: string;
  preferred_contact: "EMAIL" | "PHONE" | "WHATSAPP";
  message: string;
};

const EMPTY: FormState = {
  child_name: "",
  child_gender: "",
  child_dob: "",
  applying_for_grade_name: "",
  parent_full_name: "",
  parent_email: "",
  parent_phone: "",
  preferred_contact: "EMAIL",
  message: "",
};

const STEPS = ["Student details", "How to reach you", "Finish"] as const;

export default function SchoolEnquiryProvider({
  school,
  children,
}: {
  school: SchoolDetail;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <SchoolEnquiryContext.Provider value={value}>
      {children}
      <SchoolEnquiryDialog school={school} open={isOpen} onClose={close} />
    </SchoolEnquiryContext.Provider>
  );
}

function SchoolEnquiryDialog({
  school,
  open,
  onClose,
}: {
  school: SchoolDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; status: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Each time the popup opens, start clean and prefill what we know about the parent.
  useEffect(() => {
    if (!open) return;
    const currentUser = userRef.current;
    setStep(0);
    setError(null);
    setResult(null);
    setSubmitting(false);
    setForm({
      ...EMPTY,
      parent_full_name: currentUser
        ? `${currentUser.first_name ?? ""} ${currentUser.last_name ?? ""}`.trim()
        : "",
      parent_email: currentUser?.email ?? "",
      parent_phone: currentUser?.phone ?? "",
      preferred_contact:
        currentUser?.parent_profile?.preferred_contact_method ?? "EMAIL",
    });
  }, [open]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setError(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function next() {
    if (step === 0 && !form.child_name.trim()) {
      setError("Tell us who this enquiry is for by adding the student's name.");
      return;
    }
    if (step === 1) {
      if (!form.parent_full_name.trim() || !form.parent_email.trim() || !form.parent_phone.trim()) {
        setError("Please add your name, email and phone number so the school can reach you.");
        return;
      }
      const digits = form.parent_phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        setError("Enter a phone number with 10 to 15 digits.");
        return;
      }
    }
    setError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    setSubmitting(true);
    try {
      const payload: NewEnquiryInput = {
        school: school.school_id,
        source: "WEBSITE",
        priority: "MEDIUM",
        parent_full_name: form.parent_full_name.trim(),
        parent_email: form.parent_email.trim(),
        parent_phone: form.parent_phone.trim(),
        child_name: form.child_name.trim(),
        child_dob: form.child_dob || undefined,
        child_gender: form.child_gender || undefined,
        applying_for_grade_name: form.applying_for_grade_name.trim() || undefined,
        message:
          (form.message || "") +
          `\n\n[Preferred contact method: ${form.preferred_contact}]`,
      };
      const created = await admissions.createEnquiry(payload);
      setResult({ code: created.enquiry_code, status: created.status });
    } catch (reason: unknown) {
      setError(
        reason instanceof ApiError
          ? reason.status === 400
            ? "Some of your enquiry details are missing. Please review the fields and try again."
            : reason.message
          : "We couldn't send your enquiry right now. Please try again shortly.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="enquiry-dialog"
      aria-label={`Send an enquiry to ${school.school_name}`}
      onClose={() => {
        if (open) onClose();
      }}
      onCancel={() => onClose()}
    >
      <button
        className="enquiry-dialog__close"
        type="button"
        aria-label="Close enquiry form"
        onClick={() => dialogRef.current?.close()}
      >
        <X size={20} aria-hidden />
      </button>

      {result ? (
        <div className="enquiry-dialog__success" role="status">
          <CheckCircle2 size={26} aria-hidden />
          <h2>Enquiry sent</h2>
          <p>
            Your reference is <strong>{result.code}</strong>. {school.short_name || school.school_name}{" "}
            has your enquiry and will follow up using the contact details you shared.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <header className="enquiry-dialog__head">
            <span className="section-eyebrow">SCHOOL ENQUIRY</span>
            <h2>Send an enquiry</h2>
            <p>
              {school.short_name || school.school_name} · {STEPS[step]}
            </p>
          </header>

          <ol className="enquiry-dialog__steps">
            {STEPS.map((label, index) => (
              <li
                className={
                  index === step
                    ? "enquiry-dialog__step is-active"
                    : index < step
                      ? "enquiry-dialog__step is-done"
                      : "enquiry-dialog__step"
                }
                key={label}
              >
                <span>{index < step ? "✓" : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          <form className="enquiry-dialog__form" onSubmit={submit} noValidate>
            {error && (
              <p className="enquiry-dialog__error" role="alert">
                {error}
              </p>
            )}

            {step === 0 && (
              <div className="enquiry-dialog__body">
                <label className="field">
                  <span className="field__label">
                    Student&apos;s name <em>*</em>
                  </span>
                  <span className="field__wrap">
                    <input
                      type="text"
                      value={form.child_name}
                      onChange={(event) => patch("child_name", event.target.value)}
                      disabled={submitting}
                      placeholder="Aarav Sharma"
                    />
                  </span>
                </label>

                <label className="field">
                  <span className="field__label">Applying for grade</span>
                  <span className="field__wrap">
                    <input
                      type="text"
                      value={form.applying_for_grade_name}
                      onChange={(event) => patch("applying_for_grade_name", event.target.value)}
                      disabled={submitting}
                      placeholder="e.g. Grade 6, Nursery, Class 11"
                    />
                  </span>
                </label>

                <div className="enquiry-dialog__choices">
                  <span className="field__label">Gender</span>
                  <div className="enquiry-dialog__choice-row">
                    {[
                      { value: "" as const, label: "Prefer not to say" },
                      { value: "BOY" as const, label: "Boy" },
                      { value: "GIRL" as const, label: "Girl" },
                    ].map((option) => (
                      <label className="enquiry-dialog__choice" key={option.label}>
                        <input
                          type="radio"
                          name="child_gender"
                          checked={form.child_gender === option.value}
                          onChange={() => patch("child_gender", option.value)}
                          disabled={submitting}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="field">
                  <span className="field__label">Date of birth</span>
                  <span className="field__wrap">
                    <input
                      type="date"
                      value={form.child_dob}
                      onChange={(event) => patch("child_dob", event.target.value)}
                      disabled={submitting}
                    />
                  </span>
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="enquiry-dialog__body">
                <label className="field">
                  <span className="field__label">
                    Your full name <em>*</em>
                  </span>
                  <span className="field__wrap">
                    <input
                      type="text"
                      value={form.parent_full_name}
                      onChange={(event) => patch("parent_full_name", event.target.value)}
                      disabled={submitting}
                      autoComplete="name"
                      placeholder="Anjali Sharma"
                    />
                  </span>
                </label>

                <label className="field">
                  <span className="field__label">
                    Email <em>*</em>
                  </span>
                  <span className="field__wrap">
                    <input
                      type="email"
                      value={form.parent_email}
                      onChange={(event) => patch("parent_email", event.target.value)}
                      disabled={submitting}
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </span>
                </label>

                <label className="field">
                  <span className="field__label">
                    Phone <em>*</em>
                  </span>
                  <span className="field__wrap">
                    <input
                      type="tel"
                      value={form.parent_phone}
                      onChange={(event) => patch("parent_phone", event.target.value)}
                      disabled={submitting}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+91 98765 43210"
                    />
                  </span>
                </label>

                <div className="enquiry-dialog__choices">
                  <span className="field__label">Preferred contact</span>
                  <div className="enquiry-dialog__choice-row">
                    {[
                      { value: "PHONE" as const, label: "Phone call" },
                      { value: "EMAIL" as const, label: "Email" },
                      { value: "WHATSAPP" as const, label: "WhatsApp" },
                    ].map((option) => (
                      <label className="enquiry-dialog__choice" key={option.value}>
                        <input
                          type="radio"
                          name="preferred_contact"
                          checked={form.preferred_contact === option.value}
                          onChange={() => patch("preferred_contact", option.value)}
                          disabled={submitting}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="enquiry-dialog__body">
                <label className="field">
                  <span className="field__label">Message for the school</span>
                  <span className="field__wrap">
                    <textarea
                      rows={4}
                      value={form.message}
                      onChange={(event) => patch("message", event.target.value)}
                      disabled={submitting}
                      placeholder="Boarding preference, sibling admissions, scholarships…"
                    />
                  </span>
                </label>

                <dl className="enquiry-dialog__summary">
                  <div>
                    <dt>Student</dt>
                    <dd>
                      {form.child_name}
                      {form.applying_for_grade_name && ` · ${form.applying_for_grade_name}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>
                      {form.parent_full_name} · {form.parent_phone}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{form.parent_email}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="enquiry-dialog__actions">
              {step > 0 && (
                <button
                  className="detail-button"
                  type="button"
                  onClick={back}
                  disabled={submitting}
                >
                  <ArrowLeft size={15} aria-hidden /> Back
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button className="primary-button" type="button" onClick={next}>
                  Continue <ArrowRight size={15} aria-hidden />
                </button>
              ) : (
                <button className="primary-button" type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spin" aria-hidden /> Sending…
                    </>
                  ) : (
                    <>
                      <Send size={16} aria-hidden /> Submit enquiry
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </dialog>
  );
}
