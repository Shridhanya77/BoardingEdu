"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiErrorMessage, auth } from "@/lib/api";
import { dashboardPathForRole, useAuth } from "@/lib/auth";

function OtpVerification() {
  const params = useSearchParams();
  const router = useRouter();
  const { reloadMe } = useAuth();
  const purpose = params.get("purpose") === "register" ? "register" : "login";
  const [email, setEmail] = useState(params.get("email") || "");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await auth.verifyOtp({ email: email.trim(), otp, purpose });
      if (!result.access || !result.refresh) {
        setMessage("That code could not be verified.");
        return;
      }
      window.localStorage.setItem("boardingedu.tokens", JSON.stringify({ access: result.access, refresh: result.refresh }));
      const me = await reloadMe();
      router.push(dashboardPathForRole(me?.role));
    } catch (reason) {
      setMessage(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setMessage(null);
    try {
      const result = await auth.resendOtp({ email: email.trim(), purpose });
      setMessage(result.detail);
      setSeconds(60);
    } catch (reason) {
      setMessage(apiErrorMessage(reason));
    }
  }

  return (
    <main className="account-page">
      <section className="account-card otp-card">
        <h1>Enter your verification code</h1>
        <p>We sent a six-digit code to your email. It expires in five minutes.</p>
        <form onSubmit={verify}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Verification code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={busy || otp.length !== 6}>Verify code</button>
        </form>
        <button type="button" disabled={seconds > 0} onClick={() => void resend()}>
          {seconds > 0 ? `Resend code in ${seconds}s` : "Resend code"}
        </button>
        {message && <p role="status">{message}</p>}
        <p><Link href="/login">Back to sign in</Link></p>
      </section>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<main className="account-page"><p>Loading…</p></main>}>
      <OtpVerification />
    </Suspense>
  );
}
