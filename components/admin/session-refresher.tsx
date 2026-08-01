"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Keep the (short-lived) access token topped up while the admin is active...
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
// ...but stop doing that — and sign out — after this much inactivity. Chosen
// as a balance for a shop admin panel: short enough to matter on a shared
// counter PC, long enough not to interrupt someone mid-task who steps away
// briefly.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"] as const;

// Shared across every fetch call so concurrent 401s (e.g. a page firing off
// several queries at once) trigger a single refresh instead of a stampede.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function SessionRefresher() {
  const router = useRouter();
  const lastActivityRef = useRef<number | null>(null);
  const loggedOutRef = useRef(false);

  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now();
    }
    markActive();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActive, { passive: true })
    );

    function isWithinIdleWindow(): boolean {
      if (lastActivityRef.current === null) return true;
      return Date.now() - lastActivityRef.current < IDLE_TIMEOUT_MS;
    }

    // Covers idle timeout, a password change/reset elsewhere, a login on
    // another device (only one session is allowed per account), or an
    // admin deactivating the account — all of these make the refresh token
    // stop working, and all of them should land the admin back on /login
    // with a clear reason instead of a confusing stuck screen.
    async function forceLogout(reason: "idle" | "session-ended") {
      if (loggedOutRef.current) return;
      loggedOutRef.current = true;
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      router.push(`/login?reason=${reason}`);
    }

    const idleCheckInterval = setInterval(() => {
      if (!isWithinIdleWindow()) {
        void forceLogout("idle");
      }
    }, IDLE_CHECK_INTERVAL_MS);

    const refreshInterval = setInterval(() => {
      if (!isWithinIdleWindow()) return;
      void refreshSession().then((ok) => {
        if (!ok) void forceLogout("session-ended");
      });
    }, REFRESH_INTERVAL_MS);

    // The access token is short-lived and the interval above is a
    // best-effort keepalive — it can still miss a beat if the tab is
    // backgrounded/throttled or the laptop sleeps mid-session. Patching
    // fetch to transparently refresh-and-retry once on a 401 means the
    // user just stays logged in through that gap, the way they'd expect —
    // but only while within the idle window, so this can't quietly
    // resurrect a session that should have been timed out or was ended by
    // a login elsewhere.
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = await originalFetch(input, init);

      if (response.status !== 401) return response;

      const url = resolveUrl(input);
      const isSameOriginApiCall =
        url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
      const isAuthEndpoint = url.includes("/api/auth/");
      if (!isSameOriginApiCall || isAuthEndpoint) return response;

      if (!isWithinIdleWindow()) {
        void forceLogout("idle");
        return response;
      }

      const refreshed = await refreshSession();
      if (!refreshed) {
        void forceLogout("session-ended");
        return response;
      }

      return originalFetch(input, init);
    };

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
      clearInterval(idleCheckInterval);
      clearInterval(refreshInterval);
      window.fetch = originalFetch;
    };
  }, [router]);

  return null;
}
