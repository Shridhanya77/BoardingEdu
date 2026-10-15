"use client";

export default function SchoolRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="state-panel state-panel--error" role="alert">
    <h1>We couldn’t load this page</h1>
    <p>Please check your connection and try again.</p>
    <button type="button" onClick={reset}>Try again</button>
  </main>;
}
