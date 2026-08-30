"use client";

import { createContext, useContext } from "react";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import type { SessionUser } from "@/types/auth";

const CurrentUserContext = createContext<SessionUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

/**
 * The logged-in admin user, available anywhere under AdminShell without
 * threading a prop through every page.tsx and *-client.tsx. Throws outside
 * the admin layout, so a missing provider fails loudly instead of silently
 * rendering as "no user".
 */
export function useCurrentUser(): SessionUser {
  const user = useContext(CurrentUserContext);
  if (!user) {
    throw new Error("useCurrentUser must be used within the admin layout (CurrentUserProvider)");
  }
  return user;
}

/**
 * Staff keeps Add, View, export/download and trash access, but editing an
 * existing record and permanently deleting anything is reserved for
 * Admin/Developer/Super Admin — this mirrors the MANAGER_ROLES gate the API
 * routes enforce (see lib/api/require-role.ts usages across app/api/admin).
 */
export function useCanEdit(): boolean {
  const user = useCurrentUser();
  return MANAGER_ROLES.includes(user.role);
}
