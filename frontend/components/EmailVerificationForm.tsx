"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { ApiError, emailVerification } from "@/lib/api";

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  return `${local.slice(0, 1)}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

export default function EmailVerificationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialEmail = params.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  function setDigitsAt(start: number, value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 6 - start);
    const next = [...digits];
    if (!numbers) {
      next[start] = "";
      setDigits(next);
      setError("");
      return;
    }
    [...numbers].forEach((number, offset) => {
      next[start + offset] = number;
    });
    setDigits(next);
    inputs.current[Math.min(start + numbers.length, 5)]?.focus();
    setError("");
  }

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Enter the email address you registered with.");
      return;
    }
    const otp = digits.join("");
    if (otp.length !== 6) {
      setError("Enter all six digits from your verification email.");
      return;
    }

    setBusy(true);
    try {
      await emailVerification.verify(email.trim(), otp);
      setMessage("Your email is verified. Redirecting you to sign in…");
      window.setTimeout(() => router.replace("/login?verified=1"), 1200);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.body && typeof reason.body === "object" && "detail" in reason.body
            ? String((reason.body as { detail: unknown }).detail)
            : reason.message
          : "We could not verify that code. Please try again.",
      );
      setDigits(Array(6).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!email.trim() || remaining > 0 || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await emailVerification.resend(email.trim());
      setRemaining(60);
      setMessage("If this address has a pending account, a new code will be sent.");
      setDigits(Array(6).fill(""));
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 429
          ? "Too many requests. Please wait before trying again."
          : "We could not request another code. Please try again later.",
      );
    } finally {
      setBusy(false);
    }
  }

  const schoolAccount = params.get("account") === "school";

  return (
    <main className="account-page">
      <Link className="account-page__back" href="/login">
        <ArrowLeft size={16} /> Back to login
      </Link>
      <section className="account-card">
        <div className="email-verification__icon" aria-hidden>
          <ShieldCheck size={26} />
        </div>
        <span className="section-eyebrow">EMAIL VERIFICATION</span>
        <h1 className="account-card__lead">Check your inbox.</h1>
        <p className="email-verification__copy">
          Enter the six-digit code sent to{" "}
          <strong>{email ? maskEmail(email) : "your registered email address"}</strong>.
          The code expires after five minutes.
        </p>
        {schoolAccount && (
          <p className="email-verification__notice">
            Verifying your email does not approve the school. The existing school review
            must still be completed before school features are unlocked.
          </p>
        )}
        <form className="account-form" onSubmit={onVerify}>
          {!params.get("email") && (
            <label className="field">
              <span className="field__label">Email address</span>
              <span className="field__wrap">
                <Mail size={18} className="field__icon" aria-hidden />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  required
                />
              </span>
            </label>
          )}
          <label className="field">
            <span className="field__label">Six-digit code</span>
            <div className="email-verification__digits">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { inputs.current[index] = element; }}
                  aria-label={`Verification digit ${index + 1}`}
                  type="text"
                  inputMode="numeric"
                  autoFocus={index === 0 && Boolean(email)}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={6}
                  value={digit}
                  disabled={busy}
                  onChange={(event) => setDigitsAt(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !digits[index] && index > 0) {
                      inputs.current[index - 1]?.focus();
                    }
                    if (event.key === "ArrowLeft" && index > 0) {
                      inputs.current[index - 1]?.focus();
                    }
                    if (event.key === "ArrowRight" && index < 5) {
                      inputs.current[index + 1]?.focus();
                    }
                  }}
                  onPaste={(event) => {
                    event.preventDefault();
                    setDigitsAt(index, event.clipboardData.getData("text"));
                  }}
                />
              ))}
            </div>
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}
          {message && <div className="email-verification__success" role="status">{message}</div>}

          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Verifying…" : "Verify email"}
          </button>
        </form>

        <p className="account-card__hint">
          Didn’t receive a code?{" "}
          <button
            type="button"
            className="email-verification__resend"
            onClick={onResend}
            disabled={busy || remaining > 0 || !email.trim()}
          >
            {remaining > 0
              ? `Resend in ${remaining}s`
              : params.get("email")
                ? "Resend code"
                : "Send code"}
          </button>
        </p>
        <p className="account-card__hint">
          <Link href="/signup">Create a different account</Link>
        </p>
      </section>
    </main>
  );
}
