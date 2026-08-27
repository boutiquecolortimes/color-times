import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Shirt,
  FolderTree,
  CalendarCheck,
  Users,
  FileText,
  MessageCircle,
  Sparkles,
  BarChart3,
  UserCog,
  Ruler,
  ShoppingBag,
  IdCard,
  Receipt,
  PackagePlus,
} from "lucide-react";
import { MANAGER_ROLES, SETTINGS_ROLES } from "@/lib/auth/roles";
import type { UserRole } from "@/models/User";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

const NAV_GROUPS_BY_ROLE: { label: string; items: AdminNavItem[] }[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Inventory",
    items: [
      { label: "Categories", href: "/admin/categories", icon: FolderTree },
      { label: "Products", href: "/admin/products", icon: Shirt },
    ],
  },
  {
    label: "Rentals",
    items: [
      { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
      { label: "Dry Clean & Tailor", href: "/admin/services", icon: Sparkles },
      { label: "Customisation", href: "/admin/customisation", icon: Ruler },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Invoices", href: "/admin/invoices", icon: FileText },
      { label: "Sale", href: "/admin/sales", icon: ShoppingBag },
      { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Team", href: "/admin/users", icon: UserCog, roles: MANAGER_ROLES },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Staff", href: "/admin/staff", icon: IdCard, roles: MANAGER_ROLES },
      { label: "Expenses", href: "/admin/expenses", icon: Receipt, roles: MANAGER_ROLES },
      { label: "Purchases", href: "/admin/purchases", icon: PackagePlus, roles: MANAGER_ROLES },
    ],
  },
  {
    label: "Marketing",
    items: [{ label: "WhatsApp", href: "/admin/whatsapp", icon: MessageCircle, roles: SETTINGS_ROLES }],
  },
];

export interface AdminNavItemWithGroup extends AdminNavItem {
  groupLabel: string;
}

export const adminNavItems: AdminNavItem[] = NAV_GROUPS_BY_ROLE.flatMap((group) => group.items);

export const adminNavItemsWithGroup: AdminNavItemWithGroup[] = NAV_GROUPS_BY_ROLE.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupLabel: group.label }))
);

export function navItemsForRole(role: UserRole): AdminNavItem[] {
  return adminNavItems.filter((item) => !item.roles || item.roles.includes(role));
}

export function groupedNavItemsForRole(role: UserRole): AdminNavGroup[] {
  return NAV_GROUPS_BY_ROLE.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

const MOBILE_BOTTOM_NAV_HREFS = ["/admin", "/admin/products", "/admin/bookings", "/admin/invoices", "/admin/customers"];

export const mobileBottomNavItems: AdminNavItem[] = MOBILE_BOTTOM_NAV_HREFS.map(
  (href) => adminNavItems.find((item) => item.href === href)!
);
