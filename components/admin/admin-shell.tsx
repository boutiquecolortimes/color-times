"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import { AdminBottomNav } from "@/components/admin/bottom-nav";
import { AdminFooter } from "@/components/admin/admin-footer";
import { AdminThemeProvider, type Theme } from "@/components/admin/theme-provider";
import { SessionRefresher } from "@/components/admin/session-refresher";
import { CurrentUserProvider } from "@/components/admin/current-user-context";
import { ADMIN_SIDEBAR_COOKIE_KEY } from "@/lib/admin/sidebar-cookie";
import type { SessionUser } from "@/types/auth";

function persistSidebarExpanded(expanded: boolean): void {
  document.cookie = `${ADMIN_SIDEBAR_COOKIE_KEY}=${expanded}; path=/; max-age=31536000; SameSite=Lax`;
}

export function AdminShell({
  user,
  initialTheme,
  initialSidebarExpanded,
  children,
}: {
  user: SessionUser;
  initialTheme: Theme;
  initialSidebarExpanded: boolean;
  children: React.ReactNode;
}) {
  // Seeded from a cookie read server-side in app/admin/layout.tsx (same
  // pattern as the theme provider), so there's no post-mount flash and no
  // client effect needed just to sync an initial value. Owned here (rather
  // than inside AdminSidebar) so the content area can react to it too — the
  // sidebar is a normal flex sibling, not an overlay, so its width directly
  // resizes the space left for everything beside it.
  const [sidebarExpanded, setSidebarExpanded] = useState(initialSidebarExpanded);

  function toggleSidebar() {
    setSidebarExpanded((prev) => {
      const next = !prev;
      persistSidebarExpanded(next);
      return next;
    });
  }

  return (
    <CurrentUserProvider user={user}>
      <AdminThemeProvider initialTheme={initialTheme}>
        <SessionRefresher />
        <div className="flex h-svh overflow-hidden bg-secondary/30">
          <AdminSidebar role={user.role} expanded={sidebarExpanded} onToggle={toggleSidebar} />
          <div className="flex min-w-0 flex-1 flex-col">
            <AdminTopbar user={user} />
            <main className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              <div className="flex-1 p-4 pb-4 lg:p-8">{children}</div>
              <div className="pb-20 lg:pb-0">
                <AdminFooter />
              </div>
            </main>
          </div>
          <AdminBottomNav />
        </div>
      </AdminThemeProvider>
    </CurrentUserProvider>
  );
}
