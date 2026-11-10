"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiErrorMessage, auth, users } from "@/lib/api";

function ResetPasswordForm() {
  const params = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const confirming = Boolean(uid && token);

  return (
    <main className="account-page">
      <section className="account-card">
        <h1>{confirming ? "Choose a new password" : "Reset your password"}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const action = confirming
              ? users.confirmPasswordReset({ uid, token, password })
              : otp
                ? auth.verifyOtp({ email, otp, purpose: "password_reset", password })
                : users.requestPasswordReset(email);
            action.then((result) => setMessage(result.detail)).catch((reason) => setMessage(apiErrorMessage(reason)));
          }}
        >
          {confirming ? (
            <label>
              New password
              <input type="password" value={password} minLength={8} onChange={(event) => setPassword(event.target.value)} required />
            </label>
          ) : (
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Email code
              <input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </label>
            <label>
              New password
              <input type="password" value={password} minLength={8} onChange={(event) => setPassword(event.target.value)} />
            </label>
          )}
          <button className="primary-button" type="submit">{confirming ? "Update password" : "Send reset link"}</button>
        </form>
        {message && <p>{message}</p>}
        <p><Link href="/login">Back to sign in</Link></p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="account-page"><p>Loading…</p></main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
