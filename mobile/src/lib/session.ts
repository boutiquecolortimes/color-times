import { isAdmin } from './roles';
import type { UserRole } from '../api/types';

/**
 * Staff/admin sessions end after this long without using the app — the same
 * 8-hour idle rule as the web admin (components/admin/session-refresher.tsx).
 * Customers stay signed in, as on the website.
 */
export const IDLE_SIGNOUT_MS = 8 * 60 * 60 * 1000;

export function idleExpired(role: UserRole | null | undefined, lastActive: number | null, now = Date.now()) {
  return Boolean(isAdmin(role) && lastActive && now - lastActive > IDLE_SIGNOUT_MS);
}
