"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupedNavItemsForRole } from "@/lib/config/admin-nav";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/models/User";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminNavLinks({
  role,
  onNavigate,
  hideLabels = false,
}: {
  role: UserRole;
  onNavigate?: () => void;
  /**
   * Set by the desktop rail (components/admin/sidebar.tsx) while it's
   * collapsed — group headings and item labels shrink to nothing instead
   * of being rendered, and each link gets a title tooltip as a fallback.
   * The mobile Sheet menu (topbar.tsx) never passes this, so it keeps
   * showing full labels at all times as before.
   */
  hideLabels?: boolean;
}) {
  const pathname = usePathname();
  const groups = groupedNavItemsForRole(role);

  return (
    <nav className="flex-1 space-y-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p
            className={cn(
              "overflow-hidden px-3 text-[10px] font-semibold whitespace-nowrap uppercase tracking-wider text-sidebar-foreground/60 transition-all duration-200 ease-out",
              hideLabels ? "max-h-0 pb-0 opacity-0" : "max-h-6 pb-1.5 opacity-100"
            )}
          >
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={hideLabels ? item.label : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-semibold text-white"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 h-5 w-[3px] rounded-full bg-sidebar-primary transition-opacity",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-all duration-200 ease-out",
                      hideLabels ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
