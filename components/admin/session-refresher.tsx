"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

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
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshSession();
    }, REFRESH_INTERVAL_MS);

    // The access token is short-lived (15 min) and the interval above is a
    // best-effort keepalive — it can still miss a beat if the tab is
    // backgrounded/throttled or the laptop sleeps mid-session. Without this,
    // that showed up as a random, confusing "Unauthorized" on whatever admin
    // API call happened to fire right after the token quietly expired.
    // Patching fetch to transparently refresh-and-retry once on a 401 means
    // the user just stays logged in, the way they'd expect.
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = await originalFetch(input, init);

      if (response.status !== 401) return response;

      const url = resolveUrl(input);
      const isSameOriginApiCall = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
      const isAuthEndpoint = url.includes("/api/auth/");
      if (!isSameOriginApiCall || isAuthEndpoint) return response;

      const refreshed = await refreshSession();
      if (!refreshed) return response;

      return originalFetch(input, init);
    };

    return () => {
      clearInterval(interval);
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
