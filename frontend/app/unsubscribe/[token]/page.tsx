"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage, notificationPreferences } from "@/lib/api";

export default function UnsubscribePage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [status, setStatus] = useState<"loading" | "ready" | "done" | "invalid" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    notificationPreferences
      .unsubscribeStatus(token)
      .then((result) => {
        setEmail(result.email ?? null);
        setStatus(result.unsubscribed ? "done" : "ready");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirm() {
    setBusy(true);
    setMessage(null);
    try {
      await notificationPreferences.unsubscribe(token);
      setStatus("done");
    } catch (reason) {
      setStatus("error");
      setMessage(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-page">
      <section className="account-card otp-card">
        <h1>Email preferences</h1>
        {status === "loading" && <p>Checking your subscription…</p>}
        {status === "invalid" && (
          <>
            <p>This unsubscribe link is no longer valid.</p>
            <p><Link href="/">Back to BoardingEdu</Link></p>
          </>
        )}
        {status === "ready" && (
          <>
            <p>
              Unsubscribe{email ? ` ${email}` : ""} from school alert emails? You can re-enable alerts any time from
              your parent dashboard.
            </p>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Unsubscribing…" : "Confirm unsubscribe"}
            </button>
            <p><Link href="/">Keep receiving alerts</Link></p>
          </>
        )}
        {status === "done" && (
          <>
            <p>You have been unsubscribed from BoardingEdu school alert emails.</p>
            <p>You can re-enable them from your parent dashboard at any time.</p>
            <p><Link href="/">Back to BoardingEdu</Link></p>
          </>
        )}
        {status === "error" && (
          <>
            <p role="alert">{message ?? "Something went wrong. Please try again."}</p>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void confirm()}>
              Try again
            </button>
          </>
        )}
      </section>
    </main>
  );
}
