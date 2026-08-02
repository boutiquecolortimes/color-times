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
  collapsedOnRail = false,
}: {
  role: UserRole;
  onNavigate?: () => void;
  /**
   * Set when this is rendered inside the hover-expand desktop rail
   * (components/admin/sidebar.tsx) — group headings and item labels stay
   * hidden until the rail's `group/rail` ancestor is hovered/expanded.
   * The mobile Sheet menu (topbar.tsx) doesn't pass this, so it keeps
   * labels visible at all times as before.
   */
  collapsedOnRail?: boolean;
}) {
  const pathname = usePathname();
  const groups = groupedNavItemsForRole(role);

  return (
    <nav className="flex-1 space-y-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p
            className={cn(
              "px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap text-sidebar-foreground/60",
              collapsedOnRail &&
                "max-h-0 overflow-hidden pb-0 opacity-0 transition-all duration-200 ease-out group-hover/rail:max-h-6 group-hover/rail:pb-1.5 group-hover/rail:opacity-100"
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
                  title={collapsedOnRail ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
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
                      "whitespace-nowrap",
                      collapsedOnRail &&
                        "max-w-0 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover/rail:max-w-[180px] group-hover/rail:opacity-100"
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
