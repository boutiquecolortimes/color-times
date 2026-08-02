import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import { AdminBottomNav } from "@/components/admin/bottom-nav";
import { AdminFooter } from "@/components/admin/admin-footer";
import { AdminThemeProvider, type Theme } from "@/components/admin/theme-provider";
import { SessionRefresher } from "@/components/admin/session-refresher";
import type { SessionUser } from "@/types/auth";

export function AdminShell({
  user,
  initialTheme,
  children,
}: {
  user: SessionUser;
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  return (
    <AdminThemeProvider initialTheme={initialTheme}>
      <SessionRefresher />
      <div className="flex h-svh overflow-hidden bg-secondary/30">
        <AdminSidebar role={user.role} />
        {/* Reserves the collapsed rail's width in the flow — the sidebar
            itself is `fixed` so it can expand on hover as an overlay
            without ever resizing this content area. */}
        <div className="hidden w-16 shrink-0 lg:block" aria-hidden="true" />
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
  );
}
