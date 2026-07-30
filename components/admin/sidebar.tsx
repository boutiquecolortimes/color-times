"use client";

import Image from "next/image";
import { siteConfig } from "@/lib/config/site";
import { AdminNavLinks } from "@/components/admin/nav-links";
import { VisitWebsiteLink } from "@/components/admin/visit-website-link";
import type { UserRole } from "@/models/User";

export function AdminSidebar({ role }: { role: UserRole }) {
  return (
    <aside className="admin-sidebar-gradient hidden shadow-[2px_0_16px_rgba(0,0,0,0.18)] lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/90 p-0.5">
          <Image
            src="/logo-icon.png"
            alt={siteConfig.name}
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
        </span>
        <div className="leading-tight">
          <p className="font-heading text-lg font-semibold tracking-wide text-sidebar-foreground">
            {siteConfig.name}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
            Admin Panel
          </p>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        <AdminNavLinks role={role} />
      </div>

      <div className="border-t border-sidebar-border p-4">
        <VisitWebsiteLink />
      </div>
    </aside>
  );
}
