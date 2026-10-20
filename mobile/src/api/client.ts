import { DEFAULT_API_URL } from '../config';
import { clearTokens, loadTokens, prefs, saveTokens, type StoredTokens } from '../lib/storage';
import { logRequest } from '../lib/netlog';

export class ApiError extends Error {
  status: number;
  /** Raw provider error (e.g. Meta's response on a failed WhatsApp send), when the server includes one. */
  metaError?: unknown;
  constructor(message: string, status: number, metaError?: unknown) {
    super(message);
    this.status = status;
    this.metaError = metaError;
  }
}

type Listener = () => void;

let baseUrl = DEFAULT_API_URL;
let tokens: StoredTokens | null = null;
let refreshing: Promise<boolean> | null = null;
const sessionEndedListeners = new Set<Listener>();

export const api = {
  async init(): Promise<StoredTokens | null> {
    const override = __DEV__ ? await prefs.get('apiUrl') : null;
    if (override) baseUrl = override;
    tokens = await loadTokens();
    return tokens;
  },
  get baseUrl() {
    return baseUrl;
  },
  async setBaseUrl(url: string) {
    baseUrl = url.replace(/\/+$/, '');
    await prefs.set('apiUrl', baseUrl);
  },
  url(path: string) {
    return `${baseUrl}${path}`;
  },
  async setTokens(next: StoredTokens | null) {
    tokens = next;
    if (next) await saveTokens(next);
    else await clearTokens();
  },
  hasSession() {
    return Boolean(tokens);
  },
  /** Fired when the refresh token is rejected (password changed, deactivated, 30-day expiry). */
  onSessionEnded(listener: Listener) {
    sessionEndedListeners.add(listener);
    return () => sessionEndedListeners.delete(listener);
  },

  get: <T>(path: string, query?: Record<string, unknown>) => request<T>('GET', withQuery(path, query)),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
};

function withQuery(path: string, query?: Record<string, unknown>): string {
  if (!query) return path;
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length ? `${path}${path.includes('?') ? '&' : '?'}${params.join('&')}` : path;
}

const MOBILE_HEADERS = { 'x-client': 'color-times-mobile', Accept: 'application/json' };

async function rawFetch(method: string, path: string, body?: unknown): Promise<Response> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = { ...MOBILE_HEADERS };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    throw new ApiError(
      aborted ? 'The server took too long to respond.' : "Can't reach Color Times. Check your connection.",
      0
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshSession(): Promise<boolean> {
  if (!tokens?.refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      const log = logRequest('POST', '/api/auth/refresh', { refreshToken: tokens?.refreshToken });
      try {
        const response = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { ...MOBILE_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens?.refreshToken }),
        });
        const json = await response.json().catch(() => null);
        log.done(response.status, json);
        if (response.ok && json?.data?.accessToken) {
          await api.setTokens({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
          return true;
        }
        if (response.status === 401 || response.status === 403) {
          await api.setTokens(null);
          sessionEndedListeners.forEach((listener) => listener());
        }
        return false;
      } catch (error) {
        log.fail(errorMessage(error));
        return false;
      } finally {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let log = logRequest(method, path, body);
  let response: Response;
  try {
    response = await rawFetch(method, path, body);

    // Access JWTs live 15 minutes — renew once transparently and retry.
    if (response.status === 401 && tokens?.refreshToken && !path.startsWith('/api/auth/')) {
      log.done(401, '(access token expired — refreshing and retrying)');
      const renewed = await refreshSession();
      if (renewed) {
        log = logRequest(method, path, body);
        response = await rawFetch(method, path, body);
      }
    }
  } catch (error) {
    log.fail(errorMessage(error));
    throw error;
  }

  const json = (await response.json().catch(() => null)) as {
    success: boolean;
    data?: T;
    error?: string;
    metaError?: unknown;
  } | null;
  log.done(response.status, json);

  if (!response.ok || !json?.success) {
    throw new ApiError(
      json?.error ?? `Request failed (${response.status})`,
      response.status,
      json?.metaError ?? undefined
    );
  }
  return json.data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
