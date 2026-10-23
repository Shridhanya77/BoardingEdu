"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, LogIn, UserRound, Lock } from "lucide-react";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { dashboardPathForRole, useAuth } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("next") ?? "";

  const { login, logout, error, clearError, status } = useAuth();

  const [accountType, setAccountType] = useState<"parent" | "school" | "admin">("parent");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError?.();
    setFormError(null);
    if (!username.trim() || !password) {
      setFormError("Please enter your email or username and password.");
      return;
    }
    setSubmitting(true);
    try {
      const me = await login(username.trim(), password);
      const roleMatches = accountType === "parent"
        ? me.role === "PARENT"
        : accountType === "school"
          ? me.role === "SCHOOL_ADMIN"
          : me.role === "STAFF_ADMIN" || me.role === "SUPER_ADMIN";
      if (!roleMatches) {
        await logout();
        setFormError(
          accountType === "parent"
            ? "This account is not a parent account. Choose School admin or Staff / platform admin."
            : accountType === "school"
              ? "This account is not a school-admin account. Choose Parent or Staff / platform admin."
              : "This account is not a staff or platform-admin account. Choose Parent or School admin.",
        );
        return;
      }
      // Each role lands on its own dashboard unless a specific page was requested.
      router.push(redirectTo || dashboardPathForRole(me.role));
    } catch (err) {
      if (err instanceof ApiError) {
        const message = apiErrorMessage(err);
        setFormError(
          err.status === 401 && /invalid|no active account/i.test(message)
            ? "Email/username or password is incorrect. Please try again."
            : message,
        );
      } else {
        setFormError("Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || status === "loading";
  const finalError = formError ?? error ?? null;

  return (
    <main className="account-page">
      <Link className="account-page__back" href="/">
        <ArrowLeft size={16} /> Back to BoardingEdu
      </Link>

      <section className="account-card">
        <aside className="account-card__intro">
          <span className="section-eyebrow">BOARDINGEDU LOGIN</span>
          <h1>Welcome back.</h1>
          <p>Sign in to continue your school journey. Choose the account type you registered with.</p>
        </aside>
        <div className="account-card__content">
          <div className="account-role-choice" role="group" aria-label="Choose account type">
            {([
              ["parent", "Parent", "Find and compare schools"],
              ["school", "School admin", "Manage your school profile"],
              ["admin", "Staff / platform admin", "Manage BoardingEdu"],
            ] as const).map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                className={accountType === value ? "is-active" : ""}
                aria-pressed={accountType === value}
                onClick={() => {
                  setAccountType(value);
                  setFormError(null);
                }}
              >
                <strong>{label}</strong>
                <span>{description}</span>
              </button>
            ))}
          </div>

          <form className="account-form" onSubmit={onSubmit} noValidate>
            {finalError && (
              <div className="form-error" role="alert">{finalError}</div>
            )}

            <label className="field">
              <span className="field__label">Email or username</span>
              <span className="field__wrap">
                <UserRound size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="you@example.com or your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={busy}
                  required
                />
              </span>
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <span className="field__wrap">
                <Lock size={18} className="field__icon" aria-hidden />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="8+ characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  required
                />
              </span>
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={busy}
            >
              <LogIn size={16} />
              {busy ? "Signing you in…" : "Log in"}
            </button>

            <p className="account-card__hint">
              {accountType === "parent"
                ? <>New to BoardingEdu? <Link href="/signup">Create a parent account</Link>.</>
                : accountType === "school"
                  ? <>New school admin? <Link href="/signup/school">Register your school</Link>.</>
                  : "Staff and platform-admin accounts are created by the BoardingEdu team."}
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
