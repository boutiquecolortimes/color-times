"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Grid3x3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { BookingCalendar } from "@/components/admin/booking-calendar";
import { ReturnBookingDialog } from "@/components/admin/return-booking-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { DatePicker } from "@/components/ui/date-picker";
import { cn, formatDate } from "@/lib/utils";
import type { BookingStatus } from "@/models/Booking";

interface BookingRow {
  _id: string;
  bookingNumber: string;
  status: BookingStatus;
  rentalStartDate: string;
  rentalEndDate: string;
  totalAmount: number;
  customer: { name: string; email: string } | null;
  items: { product: { name: string } | null }[];
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
}): Promise<{ bookings: BookingRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ page: String(params.page) });
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

  const res = await fetch(`/api/admin/bookings?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function BookingsClient({
  initialBookings,
  initialPagination,
}: {
  initialBookings: BookingRow[];
  initialPagination: Pagination;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<"table" | "card" | "calendar">("table");
  const [returnDialogBookingId, setReturnDialogBookingId] = useState<string | null>(null);

  const isDefaultQuery = page === 1 && status === "all" && from === "" && to === "";

  const { data } = useQuery({
    queryKey: ["admin", "bookings", { page, status, from, to }],
    queryFn: () => fetchBookings({ page, status, from, to }),
    initialData: isDefaultQuery
      ? { bookings: initialBookings, pagination: initialPagination }
      : undefined,
  });

  const bookings = data?.bookings ?? [];
  const pagination = data?.pagination ?? initialPagination;

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
          <p className="mt-2 text-sm">{booking.customer?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{booking.customer?.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">{productSummary(booking.items)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(booking.rentalStartDate)} &rarr; {formatDate(booking.rentalEndDate)}
          </p>
          <p className="mt-2 text-sm font-medium">
            &#8377;{booking.totalAmount.toLocaleString("en-IN")}
          </p>
          <Select
            value={booking.status}
            onValueChange={(value) => {
              if (!value || value === booking.status) return;
              if (value === "returned") {
                setReturnDialogBookingId(booking._id);
                return;
              }
              updateStatusMutation.mutate({
                id: booking._id,
                status: value as BookingStatus,
              });
            }}
          >
            <SelectTrigger className="mt-3 w-full" size="sm">
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
          <ButtonLink href="/admin/bookings/new" size="sm">
            New Booking
          </ButtonLink>
        </div>
      </div>

      {view === "calendar" ? (
        <BookingCalendar />
      ) : (
        <>
          <div className="lg:hidden">{cardGrid}</div>

          {view === "card" ? (
            <div className="hidden lg:block">{cardGrid}</div>
          ) : (
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
            <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
              <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Booking #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Update</th>
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
                    <td className="px-4 py-3">
                      &#8377;{booking.totalAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={booking.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={booking.status}
                        onValueChange={(value) => {
                          if (!value || value === booking.status) return;
                          if (value === "returned") {
                            setReturnDialogBookingId(booking._id);
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
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
    </div>
  );
}
