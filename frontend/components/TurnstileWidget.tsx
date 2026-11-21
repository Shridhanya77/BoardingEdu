"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (errorCode?: string) => void;
          theme?: "light" | "dark" | "auto";
          retry?: "auto" | "never";
          "refresh-expired"?: "auto" | "manual" | "never";
        },
      ) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
    };
  }
}

export default function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!siteKey) {
      setReady(false);
      return;
    }
    setLoadError(false);
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-boardingu-turnstile="true"]',
    );
    function renderWidget() {
      if (!containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current && window.turnstile.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey!,
        theme: "light",
        retry: "auto",
        "refresh-expired": "auto",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": (errorCode) => {
          // 110200 = domain not authorized, 110100/110110 = invalid sitekey.
          if (errorCode) {
            console.warn(
              `[Turnstile] verification failed with error ${errorCode}. ` +
                "If this is 110200, add the current hostname to the widget's Hostname Management in the Cloudflare dashboard.",
            );
          }
          onTokenRef.current("");
        },
      });
      setReady(true);
    }
    if (existing) {
      if (window.turnstile) renderWidget();
      else existing.addEventListener("load", renderWidget, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.boardinguTurnstile = "true";
    script.addEventListener("load", renderWidget, { once: true });
    script.addEventListener("error", () => {
      setLoadError(true);
      setReady(false);
      onTokenRef.current("");
    }, { once: true });
    document.head.appendChild(script);
  }, [siteKey]);

  if (!siteKey) return null;
  return (
    <div className="turnstile-widget" aria-label="Cloudflare security verification">
      <div ref={containerRef} />
      {!ready && !loadError && <span>Loading verification…</span>}
      {loadError && <span role="alert">Security verification could not load. Please refresh and try again.</span>}
    </div>
  );
}
