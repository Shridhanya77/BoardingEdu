"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function fieldErrors(err: unknown, field: string): string[] | null {
  if (!(err instanceof ApiError)) return null;
  if (!err.body || typeof err.body !== "object") return null;
  const obj = err.body as Record<string, unknown>;
  const val = obj[field];
  if (!val) return null;
  if (Array.isArray(val)) return val.map((x) => String(x));
  return [String(val)];
}

export default function SignupForm() {
  const router = useRouter();
  const { register, error, clearError, status } = useAuth();
  const [accountType, setAccountType] = useState<"parent" | null>(null);

  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    password: "",
    password_confirm: "",
    address: "",
    occupation: "",
    preferred_contact_method: "EMAIL" as "EMAIL" | "PHONE" | "WHATSAPP",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [apiErr, setApiErr] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const busy = submitting || status === "loading";

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setApiErr(null);
    setFormError(null);
    clearError?.();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setApiErr(null);
    clearError?.();

    if (!form.username || !form.email || !form.first_name || !form.last_name || !form.phone) {
      setFormError("Please fill in your full name, username, email, and phone number.");
      return;
    }
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.password_confirm) {
      setFormError("Passwords do not match.");
      return;
    }
    const normalizedPhone = form.phone.replace(/[\s()-]/g, "");
    if (!/^\+?[1-9]\d{8,14}$/.test(normalizedPhone)) {
      setFormError("Enter a valid phone number with 9 to 15 digits, including country code if needed.");
      return;
    }
    setSubmitting(true);
    try {
      await register({ ...form, phone: normalizedPhone });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) setApiErr(err);
      setFormError(
        err instanceof ApiError
          ? "We couldn't create your account. See the errors below each field."
          : "Sign up failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const finalTopError = formError ?? error ?? null;

  if (!accountType) {
    return (
      <main className="account-page">
        <Link className="account-page__back" href="/">
          <ArrowLeft size={16} /> Back to BoardingEdu
        </Link>
        <section className="account-card account-card--role-picker">
          <aside className="account-card__intro">
            <span className="section-eyebrow">JOIN BOARDINGEDU</span>
            <h1>Start your school journey.</h1>
            <p>Create an account to discover schools, compare options, and connect with the right school community.</p>
          </aside>
          <div className="account-card__content">
            <h2 className="account-card__section-title">Who are you joining as?</h2>
            <div className="account-role-choice account-role-choice--signup">
              <button type="button" onClick={() => setAccountType("parent")}>
                <UserRoundPlus size={22} aria-hidden />
                <strong>Parent or guardian</strong>
                <span>Discover schools, compare options, and request counselling.</span>
              </button>
              <Link href="/signup/school">
                <Building2 size={22} aria-hidden />
                <strong>School administrator</strong>
                <span>Register your school for review and manage its public profile.</span>
              </Link>
            </div>
            <p className="account-card__hint">Already registered? <Link href="/login">Log in</Link>.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <Link className="account-page__back" href="/">
        <ArrowLeft size={16} /> Back to BoardingEdu
      </Link>

      <section className="account-card account-card--wide">
        <aside className="account-card__intro">
          <span className="section-eyebrow">CREATE A PARENT ACCOUNT</span>
          <h1>Join BoardingEdu.</h1>
          <p>Build your parent profile to shortlist schools, compare options, and get admission guidance.</p>
        </aside>
        <div className="account-card__content">
          <button className="account-role-back" type="button" onClick={() => setAccountType(null)}>
            <ArrowLeft size={15} aria-hidden /> Choose a different account type
          </button>

          <form className="account-form account-form--grid" onSubmit={onSubmit} noValidate>
          {finalTopError && (
            <div className="form-error" role="alert">{finalTopError}</div>
          )}

          <div className="row-2">
            <label className="field">
              <span className="field__label">Username <em>*</em></span>
              <span className="field__wrap">
                <UserRound size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. anjali_sharma82"
                  value={form.username}
                  onChange={(e) => setField("username", e.target.value)}
                  disabled={busy}
                  required
                />
              </span>
              {fieldErrors(apiErr, "username")?.map((m, i) => (
                <span className="field__error" key={i}>{m}</span>
              ))}
            </label>

            <label className="field">
              <span className="field__label">Phone number <em>*</em></span>
              <span className="field__wrap">
                <Phone size={18} className="field__icon" aria-hidden />
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  disabled={busy}
                  required
                />
              </span>
              {fieldErrors(apiErr, "phone")?.map((m, i) => (
                <span className="field__error" key={i}>{m}</span>
              ))}
            </label>
          </div>

          <div className="row-2">
            <label className="field">
              <span className="field__label">First name <em>*</em></span>
              <span className="field__wrap">
                <UserRoundPlus size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  autoComplete="given-name"
                  placeholder="Anjali"
                  value={form.first_name}
                  onChange={(e) => setField("first_name", e.target.value)}
                  disabled={busy}
                  required
                />
              </span>
              {fieldErrors(apiErr, "first_name")?.map((m, i) => (
                <span className="field__error" key={i}>{m}</span>
              ))}
            </label>

            <label className="field">
              <span className="field__label">Last name <em>*</em></span>
              <span className="field__wrap">
                <UserRoundPlus size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  autoComplete="family-name"
                  placeholder="Sharma"
                  value={form.last_name}
                  onChange={(e) => setField("last_name", e.target.value)}
                  disabled={busy}
                  required
                />
              </span>
              {fieldErrors(apiErr, "last_name")?.map((m, i) => (
                <span className="field__error" key={i}>{m}</span>
              ))}
            </label>
          </div>

          <label className="field">
            <span className="field__label">Email address <em>*</em></span>
            <span className="field__wrap">
              <Mail size={18} className="field__icon" aria-hidden />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                disabled={busy}
                required
              />
            </span>
            {fieldErrors(apiErr, "email")?.map((m, i) => (
              <span className="field__error" key={i}>{m}</span>
            ))}
          </label>

          <div className="row-2">
            <label className="field">
              <span className="field__label">Password <em>*</em></span>
              <span className="field__wrap">
                <ShieldCheck size={18} className="field__icon" aria-hidden />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  disabled={busy}
                  required
                />
              </span>
              {fieldErrors(apiErr, "password")?.map((m, i) => (
                <span className="field__error" key={i}>{m}</span>
              ))}
            </label>

            <label className="field">
              <span className="field__label">Confirm password <em>*</em></span>
              <span className="field__wrap">
                <ShieldCheck size={18} className="field__icon" aria-hidden />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat the password"
                  value={form.password_confirm}
                  onChange={(e) => setField("password_confirm", e.target.value)}
                  disabled={busy}
                  required
                />
              </span>
              {fieldErrors(apiErr, "password_confirm")?.map((m, i) => (
                <span className="field__error" key={i}>{m}</span>
              ))}
            </label>
          </div>

          <label className="field">
            <span className="field__label">Home address</span>
            <span className="field__wrap">
              <Building2 size={18} className="field__icon" aria-hidden />
              <input
                type="text"
                autoComplete="street-address"
                placeholder="123 Green Park, Dehradun (optional)"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                disabled={busy}
              />
            </span>
          </label>

          <div className="row-2">
            <label className="field">
              <span className="field__label">Occupation</span>
              <span className="field__wrap">
                <AtSign size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  placeholder="Software Engineer, Doctor, Business Owner (optional)"
                  value={form.occupation}
                  onChange={(e) => setField("occupation", e.target.value)}
                  disabled={busy}
                />
              </span>
            </label>

            <label className="field">
              <span className="field__label">How should schools reach you?</span>
              <select
                value={form.preferred_contact_method}
                onChange={(e) =>
                  setField("preferred_contact_method", e.target.value as typeof form.preferred_contact_method)
                }
                disabled={busy}
              >
                <option value="EMAIL">Email</option>
                <option value="PHONE">Phone call</option>
                <option value="WHATSAPP">WhatsApp message</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={busy}
          >
            <ShieldCheck size={16} />
            {busy ? "Creating your account…" : "Create my parent account"}
          </button>

          <p className="account-card__hint">
            Already have an account? <Link href="/login">Log in here</Link>.
          </p>
          </form>
        </div>
      </section>
    </main>
  );
}
