import type { UserRole } from '../api/types';

// Mirrors lib/auth/roles.ts in the web app — the API enforces these; the app
// only uses them to decide what to show.
export const ADMIN_ROLES: UserRole[] = ['staff', 'admin', 'developer', 'super_admin'];
export const MANAGER_ROLES: UserRole[] = ['admin', 'developer', 'super_admin'];
export const SETTINGS_ROLES: UserRole[] = ['developer', 'super_admin'];

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  staff: 'Staff',
  admin: 'Admin',
  developer: 'Developer',
  super_admin: 'Super Admin',
};

export const isAdmin = (role?: UserRole | null) => Boolean(role && ADMIN_ROLES.includes(role));
export const isManager = (role?: UserRole | null) => Boolean(role && MANAGER_ROLES.includes(role));
export const canSettings = (role?: UserRole | null) => Boolean(role && SETTINGS_ROLES.includes(role));
