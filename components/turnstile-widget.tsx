"use client";

import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  "0x4AAAAAAE6m5JPjRx8a6sF8";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove?: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __dineupTurnstileLoad?: Promise<void>;
  }
}

function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__dineupTurnstileLoad) return window.__dineupTurnstileLoad;

  window.__dineupTurnstileLoad = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_SRC}"]`
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Unable to load Cloudflare Turnstile.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load Cloudflare Turnstile."));
    document.head.appendChild(script);
  });

  return window.__dineupTurnstileLoad;
}

export function TurnstileWidget({
  action,
  onToken,
  resetNonce = 0,
}: {
  action: string;
  onToken: (token: string | null) => void;
  resetNonce?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        if (widgetIdRef.current && window.turnstile.remove) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        containerRef.current.innerHTML = "";

        widgetIdRef.current = window.turnstile.render(
          containerRef.current,
          {
            sitekey: TURNSTILE_SITE_KEY,
            action,
            callback: (token) => onToken(token),
            "error-callback": () => onToken(null),
            "expired-callback": () => onToken(null),
          }
        );
      })
      .catch((error) => {
        console.error("Turnstile load error:", error);
        onToken(null);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [action, onToken]);

  useEffect(() => {
    if (!resetNonce || !widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    onToken(null);
  }, [resetNonce, onToken]);

  return (
    <div
      ref={containerRef}
      aria-label="Security verification"
      style={{ minHeight: 65, marginBottom: 18 }}
    />
  );
}
