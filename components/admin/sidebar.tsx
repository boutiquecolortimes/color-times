"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { siteConfig } from "@/lib/config/site";
import { AdminNavLinks } from "@/components/admin/nav-links";
import { VisitWebsiteLink } from "@/components/admin/visit-website-link";
import { ADMIN_SIDEBAR_COOKIE_KEY } from "@/lib/admin/sidebar-cookie";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/models/User";

function persistSidebarExpanded(expanded: boolean): void {
  document.cookie = `${ADMIN_SIDEBAR_COOKIE_KEY}=${expanded}; path=/; max-age=31536000; SameSite=Lax`;
}

export function AdminSidebar({
  role,
  initialExpanded,
}: {
  role: UserRole;
  initialExpanded: boolean;
}) {
  // Seeded from a cookie read server-side in app/admin/layout.tsx (same
  // pattern as the theme provider), so there's no post-mount flash and no
  // client effect needed just to sync an initial value.
  const [expanded, setExpanded] = useState(initialExpanded);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      persistSidebarExpanded(next);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "admin-sidebar-gradient fixed inset-y-0 left-0 z-40 hidden flex-col",
        "shadow-[2px_0_16px_rgba(0,0,0,0.18)] transition-[width] duration-200 ease-out",
        "lg:flex lg:text-sidebar-foreground",
        expanded ? "w-64" : "w-16"
      )}
    >
      {/* Toggle handle — sits half-outside the right edge so it's always
          reachable regardless of collapsed/expanded state. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="absolute -right-3 top-20 z-10 grid h-6 w-6 place-items-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md transition-colors hover:bg-sidebar-accent hover:text-white"
      >
        {expanded ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      <div className="flex min-h-16 shrink-0 items-center gap-2.5 overflow-hidden border-b border-sidebar-border px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/90 p-0.5">
          <Image
            src="/logo-icon.png"
            alt={siteConfig.name}
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
        </span>
        <div
          className={cn(
            "min-w-0 overflow-hidden opacity-0 transition-all duration-200 ease-out",
            expanded ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
          )}
        >
          <p
            className="truncate font-heading text-base font-semibold text-sidebar-foreground"
            title={siteConfig.name}
          >
            {siteConfig.name}
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
            Admin Panel
          </p>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-x-hidden overflow-y-auto">
        <AdminNavLinks role={role} hideLabels={!expanded} />
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-sidebar-border transition-all duration-200 ease-out",
          expanded ? "max-h-16 p-4 opacity-100" : "max-h-0 p-0 opacity-0"
        )}
      >
        <VisitWebsiteLink className="whitespace-nowrap" />
      </div>
    </aside>
  );
}
