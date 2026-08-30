import Link from "next/link";
import {
  CalendarCheck,
  Users,
  Shirt,
  ArrowUpRight,
  Receipt,
  RotateCcw,
  AlertTriangle,
  PackageCheck,
  Undo2,
  FileWarning,
} from "lucide-react";
import { getDashboardStats, getDashboardAnalytics } from "@/lib/admin/dashboard-stats";
import { StatCard } from "@/components/admin/stat-card";
import { AttentionCard } from "@/components/admin/attention-card";
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
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // getDashboardAnalytics is the same cached function the filterable
  // "Business Analytics" panel below calls over the API — reused directly
  // here (server-side, no extra round trip) just to pull this month's top
  // dresses for the Recent Activity row, without duplicating that logic.
  const [stats, monthAnalytics] = await Promise.all([
    getDashboardStats(),
    getDashboardAnalytics({ from: startOfMonth, to: null }),
  ]);

  const revenueDelta = periodDelta(stats.monthlyRevenueTotal, stats.previousMonthRevenueTotal, "vs last month");
  const bookingsDelta = periodDelta(stats.bookingsThisMonth, stats.bookingsPreviousMonth, "vs last month");
  const newCustomersDelta = periodDelta(
    stats.newCustomersThisMonth,
    stats.newCustomersPreviousMonth,
    "vs last month"
  );

  const topDressMax = Math.max(1, ...monthAnalytics.topProducts.map((p) => p.bookings));
  const topDressRows: TabularCardRow[] = monthAnalytics.topProducts.map((entry) => ({
    key: entry.name,
    label: entry.name,
    value: `${entry.bookings} booking${entry.bookings === 1 ? "" : "s"}`,
    secondaryValue: `₹${entry.revenue.toLocaleString("en-IN")}`,
    percent: (entry.bookings / topDressMax) * 100,
  }));

  const referenceStats: { label: string; value: string }[] = [
    { label: "Total Revenue", value: `₹${stats.totalRevenue.toLocaleString("en-IN")}` },
    { label: "Total Bookings", value: stats.totalBookings.toLocaleString("en-IN") },
    { label: "Total Customers", value: stats.totalCustomers.toLocaleString("en-IN") },
    { label: "Total Dresses", value: stats.totalProducts.toLocaleString("en-IN") },
    { label: "Available Dresses", value: stats.availableDresses.toLocaleString("en-IN") },
    { label: "Reserved Dresses", value: stats.reservedDresses.toLocaleString("en-IN") },
    { label: "Outstanding Balance", value: `₹${stats.outstandingBalance.toLocaleString("en-IN")}` },
    { label: "Pending Payments", value: stats.pendingPaymentsCount.toLocaleString("en-IN") },
  ];

  return (
    <div className="space-y-6">
      {/* Needs Attention — the operational cockpit: what actually needs a
          decision or an action today, surfaced before anything else. */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-heading text-lg">Needs Attention</h2>
          <p className="text-xs text-muted-foreground">
            Today: {stats.todaysBookings} new booking{stats.todaysBookings === 1 ? "" : "s"} ·{" "}
            {stats.returnedToday} returned
          </p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <AttentionCard
            label="Returns Overdue"
            value={stats.returnsDue.toLocaleString("en-IN")}
            icon={RotateCcw}
            href="/admin/bookings"
            active={stats.returnsDue > 0}
            hint="Past their return date"
          />
          <AttentionCard
            label="Pickups Today"
            value={stats.todaysPickups.toLocaleString("en-IN")}
            icon={PackageCheck}
            href="/admin/bookings"
            active={stats.todaysPickups > 0}
          />
          <AttentionCard
            label="Returns Due Today"
            value={stats.todaysReturns.toLocaleString("en-IN")}
            icon={Undo2}
            href="/admin/bookings"
            active={stats.todaysReturns > 0}
          />
          <AttentionCard
            label="Overdue Invoices"
            value={stats.overdueInvoicesCount.toLocaleString("en-IN")}
            icon={FileWarning}
            href="/admin/invoices"
            active={stats.overdueInvoicesCount > 0}
            hint={
              stats.overdueInvoicesCount > 0
                ? `₹${stats.overdueInvoicesTotal.toLocaleString("en-IN")} outstanding`
                : undefined
            }
          />
          <AttentionCard
            label="Low Stock Items"
            value={stats.lowStockCount.toLocaleString("en-IN")}
            icon={AlertTriangle}
            href="/admin/products"
            active={stats.lowStockCount > 0}
            hint="At or below reorder threshold"
          />
        </div>
      </div>

      {/* Revenue snapshot — this month's business pulse. */}
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
          label="Bookings (this month)"
          value={stats.bookingsThisMonth.toLocaleString("en-IN")}
          icon={CalendarCheck}
          tint="teal"
          delta={bookingsDelta}
          hint={bookingsDelta ? undefined : "No bookings last month to compare"}
        />
        <StatCard
          label="Active Rentals"
          value={stats.activeRentals.toLocaleString("en-IN")}
          icon={Shirt}
          tint="wine"
          hint="Dresses currently out with customers"
        />
        <StatCard
          label="New Customers"
          value={stats.newCustomersThisMonth.toLocaleString("en-IN")}
          icon={Users}
          tint="slate"
          delta={newCustomersDelta}
          hint={newCustomersDelta ? undefined : "No new customers last month to compare"}
        />
      </div>

      {/* Trends */}
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

      {/* Recent activity */}
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
          <TabularCard
            title="Top Dresses"
            subtitle="This month, by bookings"
            rows={topDressRows}
            emptyMessage="No bookings yet this month."
          />
        </div>
      </div>

      {/* Deep-dive analytics — filterable, kept below the always-visible
          snapshot above so someone who just wants "how are we doing right
          now" never has to scroll past it. */}
      <div>
        <h2 className="font-heading text-lg">Business Analytics</h2>
        <p className="text-xs text-muted-foreground">
          Deeper breakdown across bookings, revenue and invoices — filterable by date range
        </p>
        <div className="mt-4">
          <DashboardAnalyticsPanel />
        </div>
      </div>

      {/* Catalog & lifetime reference — cumulative counts, deliberately
          quieter than everything above: nothing here is a queue to work
          through, just where things stand overall. */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-heading text-lg">Catalog &amp; Lifetime Totals</h2>
          <p className="text-xs text-muted-foreground">All-time reference numbers</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 xl:grid-cols-8">
          {referenceStats.map((item) => (
            <div key={item.label}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-heading text-xl tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
