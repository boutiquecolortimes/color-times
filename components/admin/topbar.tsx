"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Moon, Settings, Sun, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AdminNavLinks } from "@/components/admin/nav-links";
import { GlobalSearch } from "@/components/admin/global-search";
import { VisitWebsiteLink } from "@/components/admin/visit-website-link";
import { NotificationBell } from "@/components/admin/notification-bell";
import { adminNavItemsWithGroup } from "@/lib/config/admin-nav";
import { siteConfig } from "@/lib/config/site";
import { useAdminTheme } from "@/components/admin/theme-provider";
import type { SessionUser } from "@/types/auth";

function useAdminPageHeader(): { title: string; eyebrow: string } {
  const pathname = usePathname();
  const match = [...adminNavItemsWithGroup]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => (item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)));
  return { title: match?.label ?? "Admin", eyebrow: match?.groupLabel ?? "" };
}

export function AdminTopbar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { title, eyebrow } = useAdminPageHeader();
  const { theme, toggleTheme } = useAdminTheme();
  const [navOpen, setNavOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-1">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="-ml-2 lg:hidden"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <SheetContent side="left" className="admin-sidebar-gradient w-72 p-0 text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
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
              <div className="min-w-0 leading-tight">
                <p
                  className="truncate font-heading text-base font-semibold text-sidebar-foreground"
                  title={siteConfig.name}
                >
                  {siteConfig.name}
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                  Admin Panel
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminNavLinks role={user.role} onNavigate={() => setNavOpen(false)} />
            </div>
            <div className="border-t border-sidebar-border p-4">
              <VisitWebsiteLink />
            </div>
          </SheetContent>
        </Sheet>
        <div className="leading-tight">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="font-heading text-xl italic">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <GlobalSearch />
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary" />
          }
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-charcoal text-ivory">
            <UserIcon className="h-3.5 w-3.5" />
          </span>
          <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-accent">
                {user.role.replace("_", " ")}
              </p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/admin/account" />}>
            <Settings className="h-4 w-4" />
            Account Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
