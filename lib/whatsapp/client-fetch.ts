// Small fetch helper for the WhatsApp admin screens — unwraps the app's
// { success, data, error } envelope and keeps Meta's raw error for display.

export type ApiError = Error & { metaError?: unknown; status?: number };

export async function whatsappApi<T>(
  url: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: ApiError = new Error(json.error ?? `Request failed (HTTP ${res.status})`);
    error.metaError = json.metaError;
    error.status = res.status;
    throw error;
  }
  return json.data as T;
}
