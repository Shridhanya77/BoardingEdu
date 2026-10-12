"use client";
import { useState } from "react";
import { CalendarDays, Loader2, MessageSquare, Send, UserRound, AtSign, Phone } from "lucide-react";
import { admissions, type NewEnquiryInput, ApiError, type SchoolDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Props = { school: SchoolDetail };

type FormState = {
  parent_full_name: string;
  parent_email: string;
  parent_phone: string;
  child_name: string;
  child_gender: "BOY" | "GIRL" | "";
  child_dob: string;
  applying_for_grade_name: string;
  message: string;
  preferred_contact: "EMAIL" | "PHONE" | "WHATSAPP";
};

const EMPTY: FormState = {
  parent_full_name: "",
  parent_email: "",
  parent_phone: "",
  child_name: "",
  child_gender: "",
  child_dob: "",
  applying_for_grade_name: "",
  message: "",
  preferred_contact: "EMAIL",
};

export default function SchoolEnquiryForm({ school }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(() => {
    const pref = user?.parent_profile?.preferred_contact_method;
    return {
      ...EMPTY,
      parent_full_name:
        user?.first_name || user?.last_name
          ? `${user.first_name} ${user.last_name}`.trim()
          : "",
      parent_email: user?.email ?? "",
      parent_phone: user?.phone ?? "",
      preferred_contact: pref === "EMAIL" || pref === "PHONE" || pref === "WHATSAPP" ? pref : "EMAIL",
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string; status: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function patch<K extends keyof FormState>(k: K, v: FormState[K]) {
    setError(null);
    setSuccess(null);
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.parent_full_name || !form.parent_email || !form.parent_phone) {
      setError("Please enter your full name, email, and phone number so the school can reach you.");
      return;
    }
    if (!form.child_name) {
      setError("Please enter the child's name for this enquiry.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: NewEnquiryInput = {
        school: school.school_id,
        source: "WEBSITE",
        priority: "MEDIUM",
        parent_full_name: form.parent_full_name,
        parent_email: form.parent_email,
        parent_phone: form.parent_phone,
        child_name: form.child_name,
        child_dob: form.child_dob || undefined,
        child_gender: form.child_gender || undefined,
        applying_for_grade_name: form.applying_for_grade_name || undefined,
        message:
          (form.message || "") +
          `\n\n[Preferred contact method: ${form.preferred_contact}]`,
      };
      const result = await admissions.createEnquiry(payload);
      setSuccess({ code: result.enquiry_code, status: result.status });
      setForm((f) => ({
        ...EMPTY,
        parent_full_name: f.parent_full_name,
        parent_email: f.parent_email,
        parent_phone: f.parent_phone,
        preferred_contact: f.preferred_contact,
      }));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 400
            ? "Some of your enquiry details are missing. Please review and try again."
            : err.message,
        );
      } else {
        setError("We couldn't submit your enquiry right now. Please try again shortly.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="detail-panel enquiry-panel">
      <div className="detail-panel__heading">
        <span className="detail-panel__icon"><MessageSquare size={18} /></span>
        <div>
          <h2>Request a call back</h2>
          <p>The school admissions team will follow up with you using your preferred method.</p>
        </div>
      </div>

      {success ? (
        <div className="enquiry-success" role="status">
          <h3><Send size={16} /> Enquiry submitted</h3>
          <p>
            Your reference is <strong>{success.code}</strong>. The school has your enquiry
            ({success.status}) and will reach out using the details you provided.
          </p>
          <button className="detail-button" type="button" onClick={() => setSuccess(null)}>
            Submit another enquiry
          </button>
        </div>
      ) : (
        <form className="enquiry-form" onSubmit={onSubmit} noValidate>
          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="enquiry-form__row">
            <label className="field">
              <span className="field__label">Your full name <em>*</em></span>
              <span className="field__wrap">
                <UserRound size={16} className="field__icon" aria-hidden />
                <input
                  type="text"
                  value={form.parent_full_name}
                  onChange={(e) => patch("parent_full_name", e.target.value)}
                  disabled={submitting}
                  required
                  placeholder="Anjali Sharma"
                />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Email <em>*</em></span>
              <span className="field__wrap">
                <AtSign size={16} className="field__icon" aria-hidden />
                <input
                  type="email"
                  value={form.parent_email}
                  onChange={(e) => patch("parent_email", e.target.value)}
                  disabled={submitting}
                  required
                  placeholder="you@example.com"
                />
              </span>
            </label>
          </div>

          <div className="enquiry-form__row">
            <label className="field">
              <span className="field__label">Phone <em>*</em></span>
              <span className="field__wrap">
                <Phone size={16} className="field__icon" aria-hidden />
                <input
                  type="tel"
                  value={form.parent_phone}
                  onChange={(e) => patch("parent_phone", e.target.value)}
                  disabled={submitting}
                  required
                  placeholder="+91 98765 43210"
                />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Preferred contact</span>
              <select
                value={form.preferred_contact}
                onChange={(e) => patch("preferred_contact", e.target.value as FormState["preferred_contact"])}
                disabled={submitting}
              >
                <option value="EMAIL">Email</option>
                <option value="PHONE">Phone call</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </label>
          </div>

          <div className="enquiry-form__row">
            <label className="field">
              <span className="field__label">Child&apos;s name <em>*</em></span>
              <span className="field__wrap">
                <UserRound size={16} className="field__icon" aria-hidden />
                <input
                  type="text"
                  value={form.child_name}
                  onChange={(e) => patch("child_name", e.target.value)}
                  disabled={submitting}
                  required
                  placeholder="Aarav Sharma"
                />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Gender</span>
              <select
                value={form.child_gender}
                onChange={(e) => patch("child_gender", e.target.value as FormState["child_gender"])}
                disabled={submitting}
              >
                <option value="">Prefer not to say</option>
                <option value="BOY">Boy</option>
                <option value="GIRL">Girl</option>
              </select>
            </label>
          </div>

          <div className="enquiry-form__row">
            <label className="field">
              <span className="field__label">Applying for grade</span>
              <span className="field__wrap">
                <CalendarDays size={16} className="field__icon" aria-hidden />
                <input
                  type="text"
                  value={form.applying_for_grade_name}
                  onChange={(e) => patch("applying_for_grade_name", e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Grade 6, Nursery, Class 11"
                />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Child&apos;s date of birth</span>
              <input
                type="date"
                value={form.child_dob}
                onChange={(e) => patch("child_dob", e.target.value)}
                disabled={submitting}
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Message for the school</span>
            <textarea
              rows={4}
              value={form.message}
              onChange={(e) => patch("message", e.target.value)}
              disabled={submitting}
              placeholder="Share a short note — e.g. boarding preference, sibling admissions, scholarships, etc."
            />
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" />
                Submitting your enquiry…
              </>
            ) : (
              <>
                <Send size={16} />
                Submit enquiry to {school.short_name || school.school_name}
              </>
            )}
          </button>
        </form>
      )}
    </section>
  );
}
