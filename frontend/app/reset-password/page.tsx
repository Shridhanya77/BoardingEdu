"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { apiErrorMessage, auth, users } from "@/lib/api";

type ResetStep = "request" | "verify" | "complete";

function ResetPasswordForm() {
  const params = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [email, setEmail] = useState(() => params.get("email")?.trim() ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<ResetStep>("request");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const confirming = Boolean(uid && token);
  const incompleteLink = Boolean(uid || token) && !confirming;
  const requestComplete = confirming || step !== "request";
  const passwordStepComplete = step === "complete";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (confirming) {
        const result = await users.confirmPasswordReset({ uid, token, password });
        setNotice(result.detail ?? "Your password has been updated.");
        setStep("complete");
      } else if (step === "request") {
        const result = await users.requestPasswordReset(email.trim());
        setNotice(result.detail ?? "If an account exists for that email, reset instructions have been sent.");
        setStep("verify");
      } else {
        const result = await auth.verifyOtp({
          email: email.trim(),
          otp,
          purpose: "password_reset",
          password,
        });
        setNotice(result.detail ?? "Your password has been updated.");
        setStep("complete");
      }
    } catch (reason: unknown) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function resendInstructions() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const result = await users.requestPasswordReset(email.trim());
      setNotice(result.detail ?? "If an account exists for that email, reset instructions have been sent.");
    } catch (reason: unknown) {
      setError(apiErrorMessage(reason));
    } finally {
      setResending(false);
    }
  }

  function changeEmail() {
    setStep("request");
    setOtp("");
    setPassword("");
    setError(null);
    setNotice(null);
  }

  const heading = step === "complete"
    ? "Password updated"
    : confirming
      ? "Choose a new password"
      : step === "verify"
        ? "Check your email"
        : "Reset your password";
  const stepLabel = step === "complete"
    ? "COMPLETE"
    : confirming
      ? "SECURE PASSWORD RESET"
      : step === "verify"
        ? "STEP 2 OF 2"
        : "STEP 1 OF 2";

  return (
    <main className="account-page">
      <Link className="account-page__back" href="/login">
        <ArrowLeft size={16} aria-hidden />
        Back to sign in
      </Link>

      <section className="account-card account-card--password-reset">
        <aside className="account-card__intro password-reset__intro">
          <span className="section-eyebrow">ACCOUNT SECURITY</span>
          <span className="password-reset__mark" aria-hidden>
            <ShieldCheck size={25} />
          </span>
          <h1>{confirming ? "A fresh start for your account." : "Let’s get you back in."}</h1>
          <p>
            {confirming
              ? "Choose a new password to secure your BoardingEdu account."
              : "Follow a couple of simple steps to safely regain access to your account."}
          </p>
          <div className="password-reset__security-note">
            <KeyRound size={17} aria-hidden />
            <span>Your password is never sent by email.</span>
          </div>
        </aside>

        <div className="account-card__content password-reset__content">
          <div className="password-reset__stepper" aria-label="Password reset progress">
            <div
              className={`password-reset__step${!confirming && step === "request" ? " is-current" : requestComplete ? " is-complete" : ""}`}
              aria-current={!confirming && step === "request" ? "step" : undefined}
            >
              <span className="password-reset__step-number">
                {requestComplete ? <CheckCircle2 size={17} aria-hidden /> : "1"}
              </span>
              <span>Email</span>
            </div>
            <span className="password-reset__step-line" aria-hidden />
            <div
              className={`password-reset__step${passwordStepComplete ? " is-complete" : confirming || step === "verify" ? " is-current" : ""}`}
              aria-current={confirming || step === "verify" ? "step" : undefined}
            >
              <span className="password-reset__step-number">
                {passwordStepComplete ? <CheckCircle2 size={17} aria-hidden /> : "2"}
              </span>
              <span>New password</span>
            </div>
          </div>

          <div className="password-reset__heading">
            <span>{stepLabel}</span>
            <h2 className="account-card__section-title">{heading}</h2>
            <p>
              {step === "complete"
                ? "You can now sign in with your new password."
                : confirming
                  ? "Create a new password for your account."
                  : step === "verify"
                    ? "Enter the 6-digit code from your email. If you received a reset link instead, open that link to set your password."
                    : "Enter the email address linked to your account. We’ll send a verification code or a secure reset link."}
            </p>
          </div>

          {incompleteLink && step === "request" && (
            <p className="form-error" role="alert">
              This reset link is incomplete. Request fresh instructions below.
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && step !== "complete" && (
            <p className="password-reset__notice" role="status">
              {notice}
            </p>
          )}

          {step === "complete" ? (
            <div className="password-reset__success">
              <span className="password-reset__success-icon" aria-hidden>
                <CheckCircle2 size={24} />
              </span>
              <p>{notice ?? "Your password has been updated."}</p>
              <Link className="primary-button" href="/login">
                Return to sign in <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          ) : (
            <form className="account-form password-reset__form" onSubmit={submit}>
              {confirming ? (
                <label className="field">
                  <span className="field__label">New password</span>
                  <span className="field__wrap">
                    <KeyRound size={18} className="field__icon" aria-hidden />
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      required
                      autoFocus
                    />
                  </span>
                  <small className="password-reset__field-note">
                    Use at least 8 characters. Your email reset link can only be used once.
                  </small>
                </label>
              ) : step === "request" ? (
                <label className="field">
                  <span className="field__label">Email address</span>
                  <span className="field__wrap">
                    <Mail size={18} className="field__icon" aria-hidden />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
                    />
                  </span>
                  <small className="password-reset__field-note">
                    For your privacy, we’ll show the same confirmation whether or not an account matches.
                  </small>
                </label>
              ) : (
                <>
                  {!confirming && (
                    <div className="password-reset__email-summary">
                      <span className="password-reset__email-icon" aria-hidden>
                        <Mail size={17} />
                      </span>
                      <span>
                        Instructions requested for <strong>{email}</strong>
                      </span>
                    </div>
                  )}
                  <label className="field">
                    <span className="field__label">6-digit email code</span>
                    <span className="field__wrap">
                      <KeyRound size={18} className="field__icon" aria-hidden />
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        required
                        autoFocus
                      />
                    </span>
                  </label>
                  <label className="field">
                    <span className="field__label">New password</span>
                    <span className="field__wrap">
                      <KeyRound size={18} className="field__icon" aria-hidden />
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        required
                      />
                    </span>
                    <small className="password-reset__field-note">
                      Use at least 8 characters. Your current password won’t be shown or emailed.
                    </small>
                  </label>
                </>
              )}

              <button className="primary-button" type="submit" disabled={busy || resending}>
                {busy
                  ? "Please wait…"
                  : confirming
                    ? "Update password"
                    : step === "request"
                      ? "Send reset instructions"
                      : "Verify code & update password"}
                {!busy && <ArrowRight size={16} aria-hidden />}
              </button>

              {step === "verify" && !confirming && (
                <div className="password-reset__actions">
                  <button type="button" onClick={changeEmail} disabled={busy || resending}>
                    Use a different email
                  </button>
                  <button type="button" onClick={resendInstructions} disabled={busy || resending}>
                    {resending ? "Sending…" : "Resend instructions"}
                  </button>
                </div>
              )}

              {confirming && (
                <p className="account-card__hint">
                  Need a new reset link? <Link href="/reset-password">Request another one</Link>.
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="account-page"><p className="account-loading">Loading…</p></main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
