import Link from "next/link";
import {
  IndianRupee,
  CalendarCheck,
  Users,
  Shirt,
  ArrowUpRight,
  Receipt,
  RotateCcw,
  AlertTriangle,
  Package,
  CheckCircle2,
  BookmarkCheck,
  PackageCheck,
  Undo2,
  CheckCheck,
  Wallet,
} from "lucide-react";
import { getDashboardStats } from "@/lib/admin/dashboard-stats";
import { StatCard } from "@/components/admin/stat-card";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { CategoryDonutChart } from "@/components/admin/category-donut-chart";
import { TabularCard, type TabularCardRow } from "@/components/admin/tabular-card";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { DashboardAnalyticsPanel } from "@/components/admin/dashboard-analytics-panel";
import { formatDate } from "@/lib/utils";
import type { BookingStatus } from "@/models/Booking";

function periodDelta(
  current: number,
  previous: number,
  suffix: string
): { label: string; trend: "up" | "down" } | undefined {
  if (previous <= 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(change));
  return {
    label: `${rounded}% ${suffix}`,
    trend: change >= 0 ? "up" : "down",
  };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_TINTS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function avatarTint(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % AVATAR_TINTS.length;
  return AVATAR_TINTS[hash];
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  const revenueDelta = periodDelta(stats.monthlyRevenueTotal, stats.previousMonthRevenueTotal, "vs last month");
  const newCustomersDelta = periodDelta(
    stats.newCustomersThisMonth,
    stats.newCustomersPreviousMonth,
    "vs last month"
  );

  const todaysOpsMax = Math.max(
    1,
    stats.todaysBookings,
    stats.todaysPickups,
    stats.todaysReturns,
    stats.returnedToday
  );
  const todaysOperationsRows: TabularCardRow[] = [
    {
      key: "new-bookings",
      label: "New Bookings",
      value: stats.todaysBookings.toLocaleString("en-IN"),
      icon: CalendarCheck,
      color: "var(--chart-2)",
      percent: (stats.todaysBookings / todaysOpsMax) * 100,
    },
    {
      key: "pickups",
      label: "Pickups Scheduled",
      value: stats.todaysPickups.toLocaleString("en-IN"),
      icon: PackageCheck,
      color: "var(--chart-1)",
      percent: (stats.todaysPickups / todaysOpsMax) * 100,
    },
    {
      key: "returns-due",
      label: "Returns Due",
      value: stats.todaysReturns.toLocaleString("en-IN"),
      icon: Undo2,
      color: "var(--chart-4)",
      percent: (stats.todaysReturns / todaysOpsMax) * 100,
    },
    {
      key: "returned",
      label: "Returned Today",
      value: stats.returnedToday.toLocaleString("en-IN"),
      icon: CheckCheck,
      color: "var(--chart-3)",
      percent: (stats.returnedToday / todaysOpsMax) * 100,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (this month)"
          value={`₹${stats.monthlyRevenueTotal.toLocaleString("en-IN")}`}
          icon={Receipt}
          tint="gold"
          delta={revenueDelta}
          hint={revenueDelta ? undefined : "No revenue last month to compare"}
        />
        <StatCard
          label="Active Bookings"
          value={stats.activeRentals.toLocaleString("en-IN")}
          icon={CalendarCheck}
          tint="teal"
          delta={
            stats.todaysBookings > 0
              ? { label: `${stats.todaysBookings} new today`, trend: "up" }
              : undefined
          }
          hint={stats.todaysBookings > 0 ? undefined : "No new bookings today"}
        />
        <StatCard
          label="Low Stock Items"
          value={stats.lowStockCount.toLocaleString("en-IN")}
          icon={AlertTriangle}
          tint="rose"
          hint="At or below the reorder threshold"
        />
        <StatCard
          label="New Customers"
          value={stats.newCustomersThisMonth.toLocaleString("en-IN")}
          icon={Users}
          tint="wine"
          delta={newCustomersDelta}
          hint={newCustomersDelta ? undefined : "No new customers last month to compare"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <h2 className="font-heading text-lg">Revenue Overview</h2>
          <p className="text-xs text-muted-foreground">Last 6 months</p>
          <div className="mt-4">
            <RevenueChart data={stats.monthlyRevenue} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h2 className="font-heading text-lg">Bookings by Category</h2>
          <p className="text-xs text-muted-foreground">This month</p>
          <div className="mt-4">
            <CategoryDonutChart data={stats.categoryBookingBreakdown} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg">Recent Bookings</h2>
              <p className="text-xs text-muted-foreground">Latest activity across the store</p>
            </div>
            <Link
              href="/admin/bookings"
              className="flex items-center gap-1 text-sm text-accent hover:underline"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3 lg:hidden">
            {stats.recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              stats.recentBookings.map((booking) => {
                const name = booking.customer?.name ?? "Unknown customer";
                return (
                  <div key={booking._id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-heading text-xs font-semibold text-white"
                        style={{ background: avatarTint(name) }}
                      >
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {booking.productSummary}
                        </p>
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {formatDate(booking.rentalStartDate)} – {formatDate(booking.rentalEndDate)}
                    </div>
                    <BookingStatusBadge status={booking.status as BookingStatus} />
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Rental Dates</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No bookings yet.
                    </td>
                  </tr>
                ) : (
                  stats.recentBookings.map((booking) => {
                    const name = booking.customer?.name ?? "Unknown customer";
                    return (
                      <tr key={booking._id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-md font-heading text-[11px] font-semibold text-white"
                              style={{ background: avatarTint(name) }}
                            >
                              {initials(name)}
                            </span>
                            <span className="truncate font-medium">{name}</span>
                          </div>
                        </td>
                        <td className="max-w-[220px] truncate py-3 pr-3 text-muted-foreground">
                          {booking.productSummary}
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {formatDate(booking.rentalStartDate)} – {formatDate(booking.rentalEndDate)}
                        </td>
                        <td className="py-3 pr-3 text-right font-medium">
                          ₹{booking.totalAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <BookingStatusBadge status={booking.status as BookingStatus} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2">
          <TabularCard title="Today's Operations" subtitle="Snapshot of what's moving today" rows={todaysOperationsRows} />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg">Business Analytics</h2>
        <p className="text-xs text-muted-foreground">
          Deeper breakdown across bookings, revenue and invoices — filterable by date range
        </p>
        <div className="mt-4">
          <DashboardAnalyticsPanel />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg">Inventory &amp; Business Overview</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Revenue"
            value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`}
            icon={IndianRupee}
            hint="Confirmed, in-use & returned bookings"
            tint="gold"
          />
          <StatCard
            label="Outstanding Balance"
            value={`₹${stats.outstandingBalance.toLocaleString("en-IN")}`}
            icon={Wallet}
            hint="Unpaid on sent invoices"
            tint="rose"
          />
          <StatCard
            label="Returns Due"
            value={stats.returnsDue.toLocaleString("en-IN")}
            icon={RotateCcw}
            hint="Rentals past their return date"
            tint="wine"
          />
          <StatCard
            label="Total Bookings"
            value={stats.totalBookings.toLocaleString("en-IN")}
            icon={Shirt}
            tint="teal"
          />
          <StatCard
            label="Total Customers"
            value={stats.totalCustomers.toLocaleString("en-IN")}
            icon={Users}
            tint="slate"
          />
          <StatCard
            label="Total Dresses"
            value={stats.totalProducts.toLocaleString("en-IN")}
            icon={Package}
            tint="wine"
          />
          <StatCard
            label="Available Dresses"
            value={stats.availableDresses.toLocaleString("en-IN")}
            icon={CheckCircle2}
            tint="teal"
          />
          <StatCard
            label="Reserved Dresses"
            value={stats.reservedDresses.toLocaleString("en-IN")}
            icon={BookmarkCheck}
            tint="gold"
          />
          <StatCard
            label="Pending Payments"
            value={stats.pendingPaymentsCount.toLocaleString("en-IN")}
            icon={Wallet}
            hint="Invoices sent, partially paid or overdue"
            tint="rose"
          />
        </div>
      </div>
    </div>
  );
}
