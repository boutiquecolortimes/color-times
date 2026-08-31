"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  Grid3x3,
  List,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  Settings2,
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
import {
  BookingStatusBadge,
  STATUS_LABELS,
  BOOKING_STATUS_TRANSITIONS,
} from "@/components/admin/booking-status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingCalendar } from "@/components/admin/booking-calendar";
import { ReturnBookingDialog } from "@/components/admin/return-booking-dialog";
import { ConfirmBookingDialog } from "@/components/admin/confirm-booking-dialog";
import { PickupBookingDialog } from "@/components/admin/pickup-booking-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { DatePicker } from "@/components/ui/date-picker";
import { useCanEdit } from "@/components/admin/current-user-context";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";
import { cn, customerContact, formatDate } from "@/lib/utils";
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
  customer: { name: string; email: string; phone?: string } | null;
  items: { product: { name: string } | null }[];
}

interface BookingsSummary {
  totalAmount: number;
  securityDeposit: number;
  advancePaid: number;
  dueAmount: number;
}

interface StatusCounts {
  all: number;
  new: number;
  confirmed: number;
  in_use: number;
  returned: number;
  cancelled: number;
}

const EMPTY_STATUS_COUNTS: StatusCounts = {
  all: 0,
  new: 0,
  confirmed: 0,
  in_use: 0,
  returned: 0,
  cancelled: 0,
};

function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function SortIcon({
  field,
  sortBy,
  sortDir,
}: {
  field: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}) {
  if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
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

// The bookings list is categorized by lifecycle stage instead of a plain
// status dropdown — "New" collapses inquiry + any legacy pending_payment
// booking (nothing's confirmed yet), the rest map 1:1 to a stored status
// value. Cancelled bookings live under "All" only, same as before.
const STATUS_TABS: { value: string; label: string; countKey: keyof StatusCounts }[] = [
  { value: "all", label: "All", countKey: "all" },
  { value: "new", label: "New Booking", countKey: "new" },
  { value: "confirmed", label: "Confirmed", countKey: "confirmed" },
  { value: "in_use", label: "Picked Up", countKey: "in_use" },
  { value: "returned", label: "Returned", countKey: "returned" },
  { value: "cancelled", label: "Cancelled", countKey: "cancelled" },
];

// The status dropdown's options now come from BOOKING_STATUS_TRANSITIONS
// (booking-status-badge.tsx) — only the states a booking can actually move
// to next from wherever it currently is, so staff can't jump straight from
// Inquiry to Returned. "pending_payment" was never set automatically
// anywhere (booking creation defaults to "inquiry", and confirming goes
// straight to "confirmed" via the Confirm dialog), so it's still recognized
// by the schema/badge for any pre-existing booking that has it, but never
// offered as a destination.

async function fetchBookings(params: {
  page: number;
  status: string;
  from: string;
  to: string;
  search: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  view?: "active" | "trash";
  all?: boolean;
}): Promise<{
  bookings: BookingRow[];
  pagination: Pagination;
  summary: BookingsSummary;
  statusCounts: StatusCounts;
}> {
  const searchParams = new URLSearchParams({ page: String(params.page) });
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
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
  initialStatusCounts,
  canManageSettings,
}: {
  initialBookings: BookingRow[];
  initialPagination: Pagination;
  initialSummary: BookingsSummary;
  initialStatusCounts?: StatusCounts;
  canManageSettings: boolean;
}) {
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  // Default to soonest-upcoming rental first (not newest-created) — a
  // handful of bookings starting tomorrow matter more at a glance than
  // whichever was entered into the system most recently.
  const [sortBy, setSortBy] = useState("rentalStartDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [view, setView] = useState<"table" | "card" | "calendar">("table");
  const [trashView, setTrashView] = useState<"active" | "trash">("active");
  const [returnDialogBookingId, setReturnDialogBookingId] = useState<string | null>(null);
  const [confirmDialogBooking, setConfirmDialogBooking] = useState<BookingRow | null>(null);
  const [pickupDialogBooking, setPickupDialogBooking] = useState<BookingRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingRow | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<BookingRow | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isDefaultQuery =
    page === 1 &&
    status === "all" &&
    from === "" &&
    to === "" &&
    search === "" &&
    sortBy === "rentalStartDate" &&
    sortDir === "asc" &&
    trashView === "active";

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  const { data } = useQuery({
    queryKey: ["admin", "bookings", { page, status, from, to, search, sortBy, sortDir, trashView }],
    queryFn: () => fetchBookings({ page, status, from, to, search, sortBy, sortDir, view: trashView }),
    initialData: isDefaultQuery
      ? {
          bookings: initialBookings,
          pagination: initialPagination,
          summary: initialSummary,
          statusCounts: initialStatusCounts ?? EMPTY_STATUS_COUNTS,
        }
      : undefined,
  });

  const bookings = data?.bookings ?? [];
  const pagination = data?.pagination ?? initialPagination;
  const summary = data?.summary ?? initialSummary;
  const statusCounts = data?.statusCounts ?? initialStatusCounts ?? EMPTY_STATUS_COUNTS;

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
    "Sr No",
    "Booking #",
    "Bill #",
    "Booking Date",
    "Customer",
    "Contact",
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
    return rows.map((booking, index) => [
      index + 1,
      booking.bookingNumber,
      booking.billNumber || "—",
      formatDate(booking.bookingDate),
      booking.customer?.name ?? "—",
      booking.customer ? customerContact(booking.customer) : "—",
      productSummary(booking.items),
      formatDate(booking.rentalStartDate),
      formatDate(booking.rentalEndDate),
      booking.totalAmount,
      booking.securityDeposit,
      booking.advancePaid,
      booking.totalAmount - booking.advancePaid,
      STATUS_LABELS[booking.status],
    ]);
  }

  function bookingsExportTotals(rows: BookingRow[]): (string | number)[] {
    return [
      "",
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
      sortBy,
      sortDir,
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
          {booking.customer && (
            <p className="text-xs text-muted-foreground">{customerContact(booking.customer)}</p>
          )}
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
                {canEdit && (
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
                )}
              </>
            ) : (
              <>
                <ButtonLink
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  href={`/admin/bookings/${booking._id}`}
                  aria-label="View booking"
                  title="View booking"
                >
                  <Eye className="h-4 w-4" />
                </ButtonLink>
                {canEdit && (
                  <ButtonLink
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    href={`/admin/bookings/${booking._id}/edit`}
                    aria-label="Edit booking"
                    title="Edit booking"
                  >
                    <Pencil className="h-4 w-4" />
                  </ButtonLink>
                )}
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
                    if (value === "in_use") {
                      setPickupDialogBooking(booking);
                      return;
                    }
                    updateStatusMutation.mutate({
                      id: booking._id,
                      status: value as BookingStatus,
                    });
                  }}
                  disabled={BOOKING_STATUS_TRANSITIONS[booking.status].length === 0}
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue>{(value: BookingStatus) => STATUS_LABELS[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STATUS_TRANSITIONS[booking.status].map((option) => (
                      <SelectItem key={option} value={option}>
                        {STATUS_LABELS[option]}
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
      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value ?? "all");
          setPage(1);
        }}
      >
        {/*
          Six status tabs ("All" through "Cancelled") is more than a
          375px-wide screen can show at once, and TabsList's default
          inline-flex/w-fit sizing doesn't wrap or scroll on its own — the
          row was simply clipped by the viewport, cutting "Picked Up" mid
          count and hiding "Returned"/"Cancelled" entirely with no way to
          reach them. overflow-x-auto here makes the row swipeable instead;
          the negative margin lets it bleed to the page's own edges on
          mobile so the scroll area isn't inset twice.
        */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <TabsList className="w-max">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 gap-1.5">
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                    status === tab.value
                      ? "bg-accent/15 text-accent"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {statusCounts[tab.countKey]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

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
          {canManageSettings && (
            <ButtonLink
              variant="outline"
              size="icon"
              href="/admin/bookings/settings"
              aria-label="Booking settings"
              title="Booking settings"
            >
              <Settings2 className="h-4 w-4" />
            </ButtonLink>
          )}
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
                  <th className="px-4 py-3">Sr No</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("bookingNumber")}
                    >
                      Booking # <SortIcon field="bookingNumber" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("billNumber")}
                    >
                      Bill # <SortIcon field="billNumber" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("bookingDate")}
                    >
                      Booking Date <SortIcon field="bookingDate" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("rentalStartDate")}
                    >
                      Rental Dates <SortIcon field="rentalStartDate" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("totalAmount")}
                    >
                      Total <SortIcon field="totalAmount" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("securityDeposit")}
                    >
                      Security <SortIcon field="securityDeposit" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("advancePaid")}
                    >
                      Advance <SortIcon field="advancePaid" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("status")}
                    >
                      Status <SortIcon field="status" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">Update</th>
                  <th className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking, index) => (
                  <tr
                    key={booking._id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {(pagination.page - 1) * pagination.pageSize + index + 1}
                    </td>
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
                      {booking.customer && (
                        <p className="text-xs text-muted-foreground">
                          {customerContact(booking.customer)}
                        </p>
                      )}
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
                            if (value === "in_use") {
                              setPickupDialogBooking(booking);
                              return;
                            }
                            updateStatusMutation.mutate({
                              id: booking._id,
                              status: value as BookingStatus,
                            });
                          }}
                          disabled={BOOKING_STATUS_TRANSITIONS[booking.status].length === 0}
                        >
                          <SelectTrigger className="ml-auto w-40" size="sm">
                            <SelectValue>
                              {(value: BookingStatus) => STATUS_LABELS[value]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {BOOKING_STATUS_TRANSITIONS[booking.status].map((option) => (
                              <SelectItem key={option} value={option}>
                                {STATUS_LABELS[option]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {trashView === "trash" ? (
                        canEdit && (
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
                        )
                      ) : (
                        <div className="flex justify-end gap-1">
                          <ButtonLink
                            variant="ghost"
                            size="icon"
                            href={`/admin/bookings/${booking._id}`}
                            aria-label="View booking"
                            title="View booking"
                          >
                            <Eye className="h-4 w-4" />
                          </ButtonLink>
                          {canEdit && (
                            <ButtonLink
                              variant="ghost"
                              size="icon"
                              href={`/admin/bookings/${booking._id}/edit`}
                              aria-label="Edit booking"
                              title="Edit booking"
                            >
                              <Pencil className="h-4 w-4" />
                            </ButtonLink>
                          )}
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
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td
                      colSpan={14}
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
            securityDeposit: confirmDialogBooking.securityDeposit,
          }}
          open={confirmDialogBooking !== null}
          onOpenChange={(open) => !open && setConfirmDialogBooking(null)}
        />
      )}

      {pickupDialogBooking && (
        <PickupBookingDialog
          bookingId={pickupDialogBooking._id}
          summary={{
            totalAmount: pickupDialogBooking.totalAmount,
            advancePaid: pickupDialogBooking.advancePaid,
            securityDeposit: pickupDialogBooking.securityDeposit,
          }}
          open={pickupDialogBooking !== null}
          onOpenChange={(open) => !open && setPickupDialogBooking(null)}
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
