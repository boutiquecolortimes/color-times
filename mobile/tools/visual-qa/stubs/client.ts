import { fixture } from '../src/fixtures';
export class ApiError extends Error {}
const origin = location.origin;
export const api = {
  url: (p: string) => (p.startsWith('http') ? p : origin + p),
  get: async <T,>(path: string, query?: Record<string, unknown>): Promise<T> => {
    await new Promise((r) => setTimeout(r, 30));
    return fixture(path, query ?? {}) as T;
  },
  post: async () => ({}) as never,
  patch: async () => ({}) as never,
  delete: async () => ({}) as never,
  upload: async () => ({}) as never,
  setServer: () => undefined,
  onSessionEnded: () => () => undefined,
};
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
