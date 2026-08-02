"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { siteConfig } from "@/lib/config/site";
import { AdminNavLinks } from "@/components/admin/nav-links";
import { VisitWebsiteLink } from "@/components/admin/visit-website-link";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/models/User";

export function AdminSidebar({
  role,
  expanded,
  onToggle,
}: {
  role: UserRole;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "admin-sidebar-gradient relative hidden shrink-0 flex-col",
        "shadow-[2px_0_16px_rgba(0,0,0,0.18)] transition-[width] duration-200 ease-out",
        "lg:flex lg:text-sidebar-foreground",
        expanded ? "w-64" : "w-16"
      )}
    >
      {/* Toggle handle — sits half-outside the right edge so it's always
          reachable regardless of collapsed/expanded state. The sidebar is a
          normal flex sibling (not fixed/overlay), so toggling this resizes
          the content area next to it instead of covering it. */}
      <button
        type="button"
        onClick={onToggle}
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
