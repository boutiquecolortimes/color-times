import type { UserRole } from "@/models/User";

export const ADMIN_ROLES: UserRole[] = ["staff", "admin", "developer", "super_admin"];
export const MANAGER_ROLES: UserRole[] = ["admin", "developer", "super_admin"];
export const SETTINGS_ROLES: UserRole[] = ["developer", "super_admin"];

/** Every signed-in account, including customers — used by the mobile app's self-service routes. */
export const ALL_ROLES: UserRole[] = ["customer", "staff", "admin", "developer", "super_admin"];
