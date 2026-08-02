"use client";

import { CalendarCheck, IndianRupee, Receipt, Shirt } from "lucide-react";
import { TabularCard, type TabularCardRow } from "@/components/admin/tabular-card";
import { RevenueChart } from "@/components/admin/revenue-chart";
import type { BookingStatus } from "@/models/Booking";
import type { InvoiceStatus } from "@/models/Invoice";

interface DashboardAnalyticsProps {
  bookingStatusBreakdown: { status: BookingStatus; count: number }[];
  invoiceStatusBreakdown: { status: InvoiceStatus; count: number; total: number }[];
  categoryRevenue: { category: string; revenue: number; bookings: number }[];
  topProducts: { name: string; bookings: number; revenue: number }[];
  monthlyTrend: { label: string; revenue: number; bookings: number; newCustomers: number }[];
}

const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  inquiry: "#94a3b8",
  pending_payment: "#f59e0b",
  confirmed: "#3b82f6",
  in_use: "#10b981",
  returned: "#64748b",
  cancelled: "#ef4444",
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: "Inquiry",
  pending_payment: "Pending Payment",
  confirmed: "Confirmed",
  in_use: "In Use",
  returned: "Returned",
  cancelled: "Cancelled",
};

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "#94a3b8",
  sent: "#3b82f6",
  partially_paid: "#f59e0b",
  paid: "#10b981",
  overdue: "#ef4444",
  cancelled: "#64748b",
};

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function DashboardAnalytics({
  bookingStatusBreakdown,
  invoiceStatusBreakdown,
  categoryRevenue,
  topProducts,
  monthlyTrend,
}: DashboardAnalyticsProps) {
  const bookingTotal = bookingStatusBreakdown.reduce((sum, entry) => sum + entry.count, 0);
  const bookingRows: TabularCardRow[] = bookingStatusBreakdown
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      key: entry.status,
      label: BOOKING_STATUS_LABELS[entry.status],
      value: entry.count.toLocaleString("en-IN"),
      secondaryValue: bookingTotal > 0 ? `${Math.round((entry.count / bookingTotal) * 100)}%` : undefined,
      percent: bookingTotal > 0 ? (entry.count / bookingTotal) * 100 : 0,
      color: BOOKING_STATUS_COLORS[entry.status],
    }));

  const invoiceMax = Math.max(1, ...invoiceStatusBreakdown.map((entry) => entry.count));
  const invoiceRows: TabularCardRow[] = invoiceStatusBreakdown
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      key: entry.status,
      label: INVOICE_STATUS_LABELS[entry.status],
      value: formatCurrency(entry.total),
      secondaryValue: `${entry.count} invoice${entry.count === 1 ? "" : "s"}`,
      percent: (entry.count / invoiceMax) * 100,
      color: INVOICE_STATUS_COLORS[entry.status],
    }));

  const categoryMax = Math.max(1, ...categoryRevenue.map((entry) => entry.revenue));
  const categoryRows: TabularCardRow[] = categoryRevenue.map((entry) => ({
    key: entry.category,
    label: entry.category,
    value: formatCurrency(entry.revenue),
    secondaryValue: `${entry.bookings} booking${entry.bookings === 1 ? "" : "s"}`,
    percent: (entry.revenue / categoryMax) * 100,
  }));

  const productMax = Math.max(1, ...topProducts.map((entry) => entry.bookings));
  const productRows: TabularCardRow[] = topProducts.map((entry) => ({
    key: entry.name,
    label: entry.name,
    value: `${entry.bookings} booking${entry.bookings === 1 ? "" : "s"}`,
    secondaryValue: formatCurrency(entry.revenue),
    percent: (entry.bookings / productMax) * 100,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-base">Revenue &amp; Bookings Trend</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Last 12 months</p>
          </div>
          <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--gold)" }} />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-3)" }} />
              Bookings
            </span>
          </div>
        </div>
        <div className="mt-4">
          <RevenueChart data={monthlyTrend} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TabularCard
          title="Booking Status"
          subtitle="Share of all bookings"
          rows={bookingRows}
          emptyMessage="No bookings yet."
        />
        <TabularCard
          title="Invoice Status"
          subtitle="Count and value by status"
          rows={invoiceRows}
          emptyMessage="No invoices yet."
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TabularCard
          title="Revenue by Category"
          subtitle="Confirmed, in-use & returned bookings"
          rows={categoryRows}
          emptyMessage="No category revenue yet."
        />
        <TabularCard
          title="Top 5 Dresses"
          subtitle="By number of bookings"
          rows={productRows}
          emptyMessage="No bookings yet."
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-heading text-base">Monthly Detail</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Last 12 months, month by month</p>

        <div className="mt-4 space-y-3 lg:hidden">
          {monthlyTrend.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No data yet.</p>
          ) : (
            monthlyTrend.map((row) => (
              <div key={row.label} className="rounded-lg border border-border p-3">
                <p className="font-medium">{row.label}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarCheck className="h-3 w-3" /> Bookings
                    </p>
                    <p>{row.bookings}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <IndianRupee className="h-3 w-3" /> Revenue
                    </p>
                    <p>{formatCurrency(row.revenue)}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Shirt className="h-3 w-3" /> New Customers
                    </p>
                    <p>{row.newCustomers}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2 text-right">Bookings</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">New Customers</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTrend.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5" /> No data yet.
                    </span>
                  </td>
                </tr>
              ) : (
                monthlyTrend.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2 text-right">{row.bookings}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2 text-right">{row.newCustomers}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
