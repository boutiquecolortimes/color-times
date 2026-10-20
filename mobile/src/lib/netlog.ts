/**
 * Development-only API log: every request the app makes, with its query,
 * body, status, timing and response. Printed to the JS console (React Native
 * DevTools / `adb logcat -s ReactNativeJS`) and kept in memory for the in-app
 * "API log" sheet. Secrets (passwords, tokens, OTPs…) are masked. Release
 * builds record nothing.
 */

export interface NetEntry {
  id: number;
  at: number;
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  status?: number;
  ms?: number;
  response?: unknown;
  error?: string;
}

const MAX = 150;
const SECRET = /pass(word)?|token|secret|otp|^pin$|authorization|cookie|apikey|api_key/i;
const entries: NetEntry[] = [];
const listeners = new Set<() => void>();
let seq = 0;

export const netlogEnabled = typeof __DEV__ !== 'undefined' && __DEV__;

/** Deep copy with secret-looking keys masked and long strings / arrays shortened. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof FormData !== 'undefined' && value instanceof FormData) return '[form-data upload]';
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}… (${value.length} chars)` : value;
  if (typeof value !== 'object') return value;
  if (depth > 6) return '[…]';
  if (Array.isArray(value)) {
    const head = value.slice(0, 20).map((v) => redact(v, depth + 1));
    return value.length > 20 ? [...head, `… ${value.length - 20} more`] : head;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET.test(k) && v !== undefined && v !== null && v !== '' ? '•••' : redact(v, depth + 1);
  }
  return out;
}

function splitQuery(path: string): { path: string; query?: Record<string, string> } {
  const i = path.indexOf('?');
  if (i < 0) return { path };
  const query: Record<string, string> = {};
  for (const pair of path.slice(i + 1).split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    const key = decodeURIComponent(k);
    query[key] = SECRET.test(key) ? '•••' : decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return { path: path.slice(0, i), query };
}

function emit() {
  listeners.forEach((l) => l());
}

/** Call when a request starts; returns a finisher for the outcome. */
export function logRequest(method: string, fullPath: string, body?: unknown) {
  if (!netlogEnabled) return { done: () => {}, fail: () => {} };
  const { path, query } = splitQuery(fullPath);
  const entry: NetEntry = { id: ++seq, at: Date.now(), method, path, query, body: redact(body) };
  entries.unshift(entry);
  if (entries.length > MAX) entries.length = MAX;
  console.log(`[API] → ${method} ${path}`, { query: query ?? {}, body: entry.body ?? null });
  emit();

  return {
    done(status: number, response: unknown) {
      entry.status = status;
      entry.ms = Date.now() - entry.at;
      entry.response = redact(response);
      const line = `[API] ← ${status} ${method} ${path} (${entry.ms} ms)`;
      if (status >= 400) console.warn(line, entry.response);
      else console.log(line, entry.response);
      emit();
    },
    fail(message: string) {
      entry.ms = Date.now() - entry.at;
      entry.error = message;
      console.warn(`[API] ✕ ${method} ${path} (${entry.ms} ms) ${message}`);
      emit();
    },
  };
}

export const netlog = {
  entries: () => entries as readonly NetEntry[],
  clear() {
    entries.length = 0;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
