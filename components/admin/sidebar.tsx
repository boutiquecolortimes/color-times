"use client";

import Image from "next/image";
import { siteConfig } from "@/lib/config/site";
import { AdminNavLinks } from "@/components/admin/nav-links";
import { VisitWebsiteLink } from "@/components/admin/visit-website-link";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/models/User";

export function AdminSidebar({ role }: { role: UserRole }) {
  return (
    <aside
      className={cn(
        "admin-sidebar-gradient group/rail fixed inset-y-0 left-0 z-40 hidden w-16 flex-col overflow-x-hidden",
        "shadow-[2px_0_16px_rgba(0,0,0,0.18)] transition-[width] duration-200 ease-out",
        "hover:w-64 lg:flex lg:text-sidebar-foreground"
      )}
    >
      <div className="flex min-h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/90 p-0.5">
          <Image
            src="/logo-icon.png"
            alt={siteConfig.name}
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
        </span>
        <div className="min-w-0 max-w-0 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover/rail:max-w-[180px] group-hover/rail:opacity-100">
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

      <div className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
        <AdminNavLinks role={role} collapsedOnRail />
      </div>

      <div className="border-t border-sidebar-border p-4 opacity-0 transition-opacity duration-200 ease-out group-hover/rail:opacity-100">
        <VisitWebsiteLink className="whitespace-nowrap" />
      </div>
    </aside>
  );
}
