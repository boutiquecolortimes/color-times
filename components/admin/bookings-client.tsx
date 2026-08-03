"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileDown,
  Grid3x3,
  List,
  Printer,
  RotateCcw,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { BookingCalendar } from "@/components/admin/booking-calendar";
import { ReturnBookingDialog } from "@/components/admin/return-booking-dialog";
import { ConfirmBookingDialog } from "@/components/admin/confirm-booking-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { DatePicker } from "@/components/ui/date-picker";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";
import { cn, formatDate } from "@/lib/utils";
import type { BookingStatus } from "@/models/Booking";

interface BookingRow {
  _id: string;
  bookingNumber: string;
  billNumber?: string;
  bookingDate: string;
  status: BookingStatus;
  rentalStartDate: string;
  rentalEndDate: string;
  totalAmount: number;
  securityDeposit: number;
  advancePaid: number;
  customer: { name: string; email: string } | null;
  items: { product: { name: string } | null }[];
}

interface BookingsSummary {
  totalAmount: number;
  securityDeposit: number;
  advancePaid: number;
  dueAmount: number;
}

function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function productSummary(items: { product: { name: string } | null }[]): string {
  const names = items.map((item) => item.product?.name ?? "—");
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1} more`;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "inquiry", label: "Inquiry" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_use", label: "In Use" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_OPTIONS: BookingStatus[] = [
  "inquiry",
  "pending_payment",
  "confirmed",
  "in_use",
  "returned",
  "cancelled",
];

async function fetchBookings(params: {
  page: number;
  status: string;
  from: string;
  to: string;
  search: string;
  view?: "active" | "trash";
  all?: boolean;
}): Promise<{ bookings: BookingRow[]; pagination: Pagination; summary: BookingsSummary }> {
  const searchParams = new URLSearchParams({ page: String(params.page) });
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.search) searchParams.set("search", params.search);
  if (params.view) searchParams.set("view", params.view);
  if (params.all) searchParams.set("all", "true");

  const res = await fetch(`/api/admin/bookings?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function BookingsClient({
  initialBookings,
  initialPagination,
  initialSummary,
}: {
  initialBookings: BookingRow[];
  initialPagination: Pagination;
  initialSummary: BookingsSummary;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "card" | "calendar">("table");
  const [trashView, setTrashView] = useState<"active" | "trash">("active");
  const [returnDialogBookingId, setReturnDialogBookingId] = useState<string | null>(null);
  const [confirmDialogBooking, setConfirmDialogBooking] = useState<BookingRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingRow | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<BookingRow | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isDefaultQuery =
    page === 1 &&
    status === "all" &&
    from === "" &&
    to === "" &&
    search === "" &&
    trashView === "active";

  const { data } = useQuery({
    queryKey: ["admin", "bookings", { page, status, from, to, search, trashView }],
    queryFn: () => fetchBookings({ page, status, from, to, search, view: trashView }),
    initialData: isDefaultQuery
      ? { bookings: initialBookings, pagination: initialPagination, summary: initialSummary }
      : undefined,
  });

  const bookings = data?.bookings ?? [];
  const pagination = data?.pagination ?? initialPagination;
  const summary = data?.summary ?? initialSummary;

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status: newStatus,
    }: {
      id: string;
      status: BookingStatus;
    }) => {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.booking;
    },
    onSuccess: () => {
      toast.success("Booking status updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Booking moved to trash");
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/bookings/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Booking restored");
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/bookings/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Booking permanently deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      setPermanentDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportHeaders = [
    "Booking #",
    "Bill #",
    "Booking Date",
    "Customer",
    "Email",
    "Product",
    "Rental Start",
    "Rental End",
    "Total",
    "Security",
    "Advance",
    "Due",
    "Status",
  ];

  function bookingsToRows(rows: BookingRow[]): (string | number)[][] {
    return rows.map((booking) => [
      booking.bookingNumber,
      booking.billNumber || "—",
      formatDate(booking.bookingDate),
      booking.customer?.name ?? "—",
      booking.customer?.email ?? "—",
      productSummary(booking.items),
      formatDate(booking.rentalStartDate),
      formatDate(booking.rentalEndDate),
      booking.totalAmount,
      booking.securityDeposit,
      booking.advancePaid,
      booking.totalAmount - booking.advancePaid,
      booking.status.replace("_", " "),
    ]);
  }

  function bookingsExportTotals(rows: BookingRow[]): (string | number)[] {
    return [
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      rows.reduce((sum, b) => sum + b.totalAmount, 0),
      rows.reduce((sum, b) => sum + b.securityDeposit, 0),
      rows.reduce((sum, b) => sum + b.advancePaid, 0),
      rows.reduce((sum, b) => sum + (b.totalAmount - b.advancePaid), 0),
      "",
    ];
  }

  async function fetchAllBookingsForExport(): Promise<BookingRow[]> {
    const result = await fetchBookings({
      page: 1,
      status,
      from,
      to,
      search,
      view: trashView,
      all: true,
    });
    return result.bookings;
  }

  async function withExportGuard(action: () => Promise<void>): Promise<void> {
    setIsExporting(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportExcel() {
    void withExportGuard(async () => {
      const bookingRows = await fetchAllBookingsForExport();
      await downloadExcel(
        "bookings",
        "Bookings",
        exportHeaders,
        bookingsToRows(bookingRows),
        bookingsExportTotals(bookingRows)
      );
    });
  }

  function handleExportPdf() {
    void withExportGuard(async () => {
      const bookingRows = await fetchAllBookingsForExport();
      await downloadPdf(
        "bookings",
        "Bookings",
        exportHeaders,
        bookingsToRows(bookingRows),
        bookingsExportTotals(bookingRows)
      );
    });
  }

  function handlePrint() {
    window.print();
  }

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {bookings.map((booking) => (
        <div key={booking._id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/admin/bookings/${booking._id}`}
              className="font-medium hover:text-accent hover:underline"
            >
              {booking.bookingNumber}
            </Link>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bill #{booking.billNumber || "—"} · Booked {formatDate(booking.bookingDate)}
          </p>
          <p className="mt-2 text-sm">{booking.customer?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{booking.customer?.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">{productSummary(booking.items)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(booking.rentalStartDate)} &rarr; {formatDate(booking.rentalEndDate)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Total</span>
            <span className="text-right font-medium text-foreground">
              {formatINR(booking.totalAmount)}
            </span>
            <span>Security</span>
            <span className="text-right">{formatINR(booking.securityDeposit)}</span>
            <span>Advance</span>
            <span className="text-right">{formatINR(booking.advancePaid)}</span>
            <span>Due</span>
            <span className="text-right font-medium text-accent">
              {formatINR(booking.totalAmount - booking.advancePaid)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {trashView === "trash" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => restoreMutation.mutate(booking._id)}
                  disabled={restoreMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  aria-label="Delete booking permanently"
                  title="Delete permanently"
                  onClick={() => setPermanentDeleteTarget(booking)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Select
                  value={booking.status}
                  onValueChange={(value) => {
                    if (!value || value === booking.status) return;
                    if (value === "returned") {
                      setReturnDialogBookingId(booking._id);
                      return;
                    }
                    if (value === "confirmed") {
                      setConfirmDialogBooking(booking);
                      return;
                    }
                    updateStatusMutation.mutate({
                      id: booking._id,
                      status: value as BookingStatus,
                    });
                  }}
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue>{(value: string) => value.replace("_", " ")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  aria-label="Delete booking"
                  title="Move to trash"
                  onClick={() => setDeleteTarget(booking)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      {bookings.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">No bookings found.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search booking #, code, dress, or customer..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue>
                {(value: string) =>
                  STATUS_FILTERS.find((option) => option.value === value)?.label ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={trashView}
            onValueChange={(value) => {
              setTrashView((value ?? "active") as "active" | "trash");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue>{(value: string) => (value === "trash" ? "Trash" : "Active")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trash">Trash</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <DatePicker
              value={from}
              onChange={(value) => {
                setFrom(value);
                setPage(1);
              }}
              placeholder="From date"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <DatePicker
              value={to}
              onChange={(value) => {
                setTo(value);
                setPage(1);
              }}
              placeholder="To date"
            />
            {(from || to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <div className="flex shrink-0 rounded-md border border-border p-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setView(view === "calendar" ? "card" : "calendar")}
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-muted-foreground"
            >
              {view === "calendar" ? (
                <>
                  <List className="h-4 w-4" /> List
                </>
              ) : (
                <>
                  <CalendarDays className="h-4 w-4" /> Calendar
                </>
              )}
            </button>
          </div>
          <div className="hidden shrink-0 rounded-md border border-border p-0.5 lg:flex">
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm",
                view === "table"
                  ? "bg-secondary font-medium"
                  : "text-muted-foreground",
              )}
            >
              <List className="h-4 w-4" /> Table
            </button>
            <button
              type="button"
              onClick={() => setView("card")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm",
                view === "card"
                  ? "bg-secondary font-medium"
                  : "text-muted-foreground",
              )}
            >
              <Grid3x3 className="h-4 w-4" /> Card
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm",
                view === "calendar"
                  ? "bg-secondary font-medium"
                  : "text-muted-foreground",
              )}
            >
              <CalendarDays className="h-4 w-4" /> Calendar
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view !== "calendar" && (
            <p className="text-sm text-muted-foreground">
              {pagination.total} bookings
            </p>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={isExporting} />}>
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <Table2 className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileDown className="h-4 w-4" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ButtonLink href="/admin/bookings/new" size="sm">
            New Booking
          </ButtonLink>
        </div>
      </div>

      {view !== "calendar" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Earnings</p>
            <p className="mt-1 font-heading text-lg">{formatINR(summary.totalAmount)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Security Held</p>
            <p className="mt-1 font-heading text-lg">{formatINR(summary.securityDeposit)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Advance Collected</p>
            <p className="mt-1 font-heading text-lg">{formatINR(summary.advancePaid)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Due Amount</p>
            <p className="mt-1 font-heading text-lg text-accent">{formatINR(summary.dueAmount)}</p>
          </div>
        </div>
      )}

      {view === "calendar" ? (
        <BookingCalendar />
      ) : (
        <>
          <div className="lg:hidden">{cardGrid}</div>

          {view === "card" ? (
            <div className="hidden lg:block">{cardGrid}</div>
          ) : (
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
            <table className="w-full min-w-[1240px] text-sm whitespace-nowrap">
              <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Booking #</th>
                  <th className="px-4 py-3">Bill #</th>
                  <th className="px-4 py-3">Booking Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Rental Dates</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Security</th>
                  <th className="px-4 py-3">Advance</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Update</th>
                  <th className="px-4 py-3 text-right">
                    <span className="sr-only">Delete</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr
                    key={booking._id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/admin/bookings/${booking._id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {booking.bookingNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {booking.billNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(booking.bookingDate)}
                    </td>
                    <td className="px-4 py-3">
                      <p>{booking.customer?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.customer?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {productSummary(booking.items)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(booking.rentalStartDate)} &rarr;{" "}
                      {formatDate(booking.rentalEndDate)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatINR(booking.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatINR(booking.securityDeposit)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatINR(booking.advancePaid)}
                    </td>
                    <td className="px-4 py-3 font-medium text-accent">
                      {formatINR(booking.totalAmount - booking.advancePaid)}
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={booking.status} />
                    </td>
                    <td className="px-4 py-3">
                      {trashView === "trash" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-auto flex"
                          onClick={() => restoreMutation.mutate(booking._id)}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Restore
                        </Button>
                      ) : (
                        <Select
                          value={booking.status}
                          onValueChange={(value) => {
                            if (!value || value === booking.status) return;
                            if (value === "returned") {
                              setReturnDialogBookingId(booking._id);
                              return;
                            }
                            if (value === "confirmed") {
                              setConfirmDialogBooking(booking);
                              return;
                            }
                            updateStatusMutation.mutate({
                              id: booking._id,
                              status: value as BookingStatus,
                            });
                          }}
                        >
                          <SelectTrigger className="ml-auto w-40" size="sm">
                            <SelectValue>
                              {(value: string) => value.replace("_", " ")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {trashView === "trash" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          aria-label="Delete booking permanently"
                          title="Delete permanently"
                          onClick={() => setPermanentDeleteTarget(booking)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          aria-label="Delete booking"
                          title="Move to trash"
                          onClick={() => setDeleteTarget(booking)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No bookings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            itemLabel="bookings"
            onPageChange={setPage}
          />
        </>
      )}

      <ReturnBookingDialog
        bookingId={returnDialogBookingId}
        open={returnDialogBookingId !== null}
        onOpenChange={(open) => !open && setReturnDialogBookingId(null)}
      />

      {confirmDialogBooking && (
        <ConfirmBookingDialog
          bookingId={confirmDialogBooking._id}
          summary={{
            totalAmount: confirmDialogBooking.totalAmount,
            advancePaid: confirmDialogBooking.advancePaid,
          }}
          open={confirmDialogBooking !== null}
          onOpenChange={(open) => !open && setConfirmDialogBooking(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Move booking to trash?"
        description={
          deleteTarget
            ? `Move booking ${deleteTarget.bookingNumber}${deleteTarget.customer ? ` for ${deleteTarget.customer.name}` : ""} to Trash? It will disappear from this list but can be restored later, or permanently deleted from Trash.`
            : ""
        }
        confirmLabel="Move to Trash"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget._id);
        }}
      />

      <ConfirmDialog
        open={permanentDeleteTarget !== null}
        onOpenChange={(open) => !open && setPermanentDeleteTarget(null)}
        title="Permanently delete booking?"
        description={
          permanentDeleteTarget
            ? `Permanently delete booking ${permanentDeleteTarget.bookingNumber}${permanentDeleteTarget.customer ? ` for ${permanentDeleteTarget.customer.name}` : ""}? This cannot be undone. Blocked if any invoices or service orders still reference it.`
            : ""
        }
        confirmLabel="Delete Permanently"
        variant="destructive"
        isLoading={permanentDeleteMutation.isPending}
        onConfirm={() => {
          if (permanentDeleteTarget) permanentDeleteMutation.mutate(permanentDeleteTarget._id);
        }}
      />
    </div>
  );
}
