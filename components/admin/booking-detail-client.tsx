"use client";

import { useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Loader2, Pencil, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookingStatusBadge, STATUS_LABELS } from "@/components/admin/booking-status-badge";
import { ReturnBookingDialog } from "@/components/admin/return-booking-dialog";
import { ConfirmBookingDialog } from "@/components/admin/confirm-booking-dialog";
import { PickupBookingDialog } from "@/components/admin/pickup-booking-dialog";
import { AuditLogList } from "@/components/admin/audit-log-list";
import {
  ServiceOrderFormDialog,
  type ServiceOrderInitialValues,
} from "@/components/admin/service-order-form-dialog";
import { formatDate, isWalkinEmail } from "@/lib/utils";
import type { BookingStatus, ReturnCondition } from "@/models/Booking";

const REMINDABLE_STATUSES: BookingStatus[] = ["inquiry", "confirmed", "in_use"];

// "pending_payment" is dropped from the picker — it was never set
// automatically anywhere and just added a confusing extra option. Still
// recognized by the schema/badge for any pre-existing booking that has it.
const STATUS_OPTIONS: BookingStatus[] = [
  "inquiry",
  "confirmed",
  "in_use",
  "returned",
  "cancelled",
];

const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  good: "Good — no issues",
  minor_damage: "Minor damage",
  major_damage: "Major damage",
  missing_items: "Missing items",
};

interface BookingItemDetail {
  product: { _id: string; name: string; images: string[]; sku: string } | null;
  size: string;
  quantity: number;
  pricePerDay: number;
  rentalFee: number;
  wearerName?: string;
  measurements?: {
    upperChest?: number;
    lowerChest?: number;
    sleeveLength?: number;
    armhole?: number;
    other?: string;
  };
}

interface BookingDetail {
  _id: string;
  bookingNumber: string;
  billNumber?: string;
  bookingDate: string;
  status: BookingStatus;
  customer: { name: string; email: string; phone?: string } | null;
  items: BookingItemDetail[];
  rentalStartDate: string;
  rentalEndDate: string;
  eventDate: string;
  securityDeposit: number;
  totalAmount: number;
  advancePaid?: number;
  advancePaymentMethod?: string;
  deliveryAddress?: string;
  notes?: string;
  returnCondition?: ReturnCondition;
  returnNotes?: string;
  returnedAt?: string | null;
  dryCleaningRequired?: boolean;
  stitchingRequired?: boolean;
  damageCharges?: number;
  pendingRentAmount?: number;
  depositRefunded?: boolean;
  depositRefundAmount?: number;
  finalSettlementAmount?: number;
  createdAt: string;
}

interface InvoiceSummary {
  _id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  amountDue: number;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

async function fetchBooking(id: string): Promise<BookingDetail> {
  const res = await fetch(`/api/admin/bookings/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.booking;
}

export function BookingDetailClient({
  initialBooking,
  invoice,
}: {
  initialBooking: BookingDetail;
  invoice?: InvoiceSummary | null;
}) {
  const queryClient = useQueryClient();
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const [dryCleanValues, setDryCleanValues] = useState<ServiceOrderInitialValues | null>(null);
  const [dryCleanDialogOpen, setDryCleanDialogOpen] = useState(false);

  const { data: booking = initialBooking } = useQuery({
    queryKey: ["admin", "booking", initialBooking._id],
    queryFn: () => fetchBooking(initialBooking._id),
    initialData: initialBooking,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (nextStatus: BookingStatus) => {
      const res = await fetch(`/api/admin/bookings/${booking._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.booking;
    },
    onSuccess: () => {
      toast.success("Booking status updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "booking", booking._id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remindMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/bookings/${booking._id}/remind`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => toast.success("Reminder sent"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl">{booking.bookingNumber}</h1>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {formatDate(booking.createdAt)}
            {booking.billNumber && ` · Bill #${booking.billNumber}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {invoice && (
            <ButtonLink
              variant="outline"
              size="sm"
              href={`/admin/invoices/${invoice._id}`}
              title="View and print invoice"
            >
              <Printer className="h-4 w-4" />
              Invoice #{invoice.invoiceNumber}
            </ButtonLink>
          )}
          {booking.status !== "returned" && booking.status !== "cancelled" && (
            <ButtonLink variant="outline" size="sm" href={`/admin/bookings/${booking._id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </ButtonLink>
          )}
          {REMINDABLE_STATUSES.includes(booking.status) && (
            <Button
              variant="outline"
              size="sm"
              disabled={remindMutation.isPending}
              onClick={() => remindMutation.mutate()}
            >
              {remindMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              {booking.status === "in_use" ? "Send Return Reminder" : "Send Reminder"}
            </Button>
          )}
          <Select
            value={booking.status}
            onValueChange={(value) => {
              if (!value || value === booking.status) return;
              if (value === "returned") {
                setReturnDialogOpen(true);
                return;
              }
              if (value === "confirmed") {
                setConfirmDialogOpen(true);
                return;
              }
              if (value === "in_use") {
                setPickupDialogOpen(true);
                return;
              }
              updateStatusMutation.mutate(value as BookingStatus);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue>{(value: BookingStatus) => STATUS_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Customer</h2>
              <p className="mt-2 text-sm">{booking.customer?.name ?? "—"}</p>
              {booking.customer?.phone && (
                <p className="text-sm text-muted-foreground">{booking.customer.phone}</p>
              )}
              {/* Walk-in bookings get a generated placeholder email just to
                  satisfy the unique/required field — never show that as if
                  it were a real contact address. */}
              {booking.customer?.email && !isWalkinEmail(booking.customer.email) && (
                <p className="text-sm text-muted-foreground">{booking.customer.email}</p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">
                {booking.items.length > 1 ? `Dresses (${booking.items.length})` : "Dress"}
              </h2>
              <div className="mt-2 space-y-3">
                {booking.items.map((item, index) => {
                  const m = item.measurements;
                  const measurementEntries = m
                    ? ([
                        ["UC", m.upperChest],
                        ["LC", m.lowerChest],
                        ["SL", m.sleeveLength],
                        ["AH", m.armhole],
                      ] as const).filter(([, value]) => value !== undefined && value !== null)
                    : [];
                  const hasMeasurements = measurementEntries.length > 0 || Boolean(m?.other);

                  return (
                    <div key={index} className="rounded-lg border border-border/60 p-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {item.product?.images?.[0] && (
                            <Image
                              src={item.product.images[0]}
                              alt={item.product.name}
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded-md object-cover"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium">{item.product?.name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.product?.sku} &middot; Size {item.size}
                              {item.quantity > 1 && ` ×${item.quantity}`}
                            </p>
                            {item.wearerName && (
                              <p className="text-xs text-muted-foreground">
                                For {item.wearerName}
                              </p>
                            )}
                          </div>
                        </div>
                        {booking.status === "returned" && item.product && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDryCleanValues({
                                product: item.product!._id,
                                booking: booking._id,
                                description: `Post-return dry clean for booking ${booking.bookingNumber}`,
                              });
                              setDryCleanDialogOpen(true);
                            }}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Send to Dry Clean
                          </Button>
                        )}
                      </div>
                      {hasMeasurements && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {measurementEntries.map(([label, value]) => `${label} ${value}"`).join(" · ")}
                          {m?.other ? `${measurementEntries.length > 0 ? " · " : ""}${m.other}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Rental Period</h2>
              <div className="mt-2 space-y-1 text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Booking Date</span>
                  <span>{formatDate(booking.bookingDate)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Event Date</span>
                  <span>{formatDate(booking.eventDate)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Pickup Date</span>
                  <span>{formatDate(booking.rentalStartDate)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Return Date</span>
                  <span>{formatDate(booking.rentalEndDate)}</span>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Billing</h2>
              <div className="mt-2 space-y-1 text-sm">
                {booking.items.map((item, index) => (
                  <p key={index} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {item.product?.name ?? "Item"} rental fee
                    </span>
                    <span>{formatCurrency(item.rentalFee)}</span>
                  </p>
                ))}
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Security Deposit</span>
                  <span>{formatCurrency(booking.securityDeposit)}</span>
                </p>
                <p className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatCurrency(booking.totalAmount)}</span>
                </p>
                {Boolean(booking.advancePaid) && (
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">
                      Advance Paid
                      {booking.advancePaymentMethod ? ` (${booking.advancePaymentMethod})` : ""}
                    </span>
                    <span>{formatCurrency(booking.advancePaid ?? 0)}</span>
                  </p>
                )}
                <p className="flex justify-between border-t border-border pt-2 font-medium">
                  <span>Due Amount</span>
                  <span className="text-accent">
                    {formatCurrency(booking.totalAmount - (booking.advancePaid ?? 0))}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {booking.deliveryAddress && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Delivery Address</h2>
              <p className="mt-2 text-sm text-muted-foreground">{booking.deliveryAddress}</p>
            </div>
          )}

          {booking.notes && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Notes</h2>
              <p className="mt-2 text-sm text-muted-foreground">{booking.notes}</p>
            </div>
          )}

          {(booking.returnCondition || booking.returnNotes) && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Return Details</h2>
              <div className="mt-2 space-y-1 text-sm">
                {booking.returnedAt && (
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Returned On</span>
                    <span>{formatDate(booking.returnedAt)}</span>
                  </p>
                )}
                {booking.returnCondition && (
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Condition</span>
                    <span>{RETURN_CONDITION_LABELS[booking.returnCondition]}</span>
                  </p>
                )}
                {booking.returnNotes && (
                  <p className="mt-2 text-muted-foreground">{booking.returnNotes}</p>
                )}
                {(booking.dryCleaningRequired || booking.stitchingRequired) && (
                  <p className="text-muted-foreground">
                    Sent to Services:{" "}
                    {[
                      booking.dryCleaningRequired && "Dry cleaning",
                      booking.stitchingRequired && "Stitching / repair",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {booking.returnedAt && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Damage Charges</span>
                      <span>{formatCurrency(booking.damageCharges ?? 0)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Pending Rent</span>
                      <span>{formatCurrency(booking.pendingRentAmount ?? 0)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Deposit Refunded</span>
                      <span>
                        {booking.depositRefunded
                          ? formatCurrency(booking.depositRefundAmount ?? 0)
                          : "Not yet"}
                      </span>
                    </p>
                    <p className="flex justify-between font-medium">
                      <span>
                        {(booking.finalSettlementAmount ?? 0) > 0
                          ? "Customer still owes"
                          : "Net refund to customer"}
                      </span>
                      <span>
                        {formatCurrency(
                          (booking.finalSettlementAmount ?? 0) > 0
                            ? (booking.finalSettlementAmount ?? 0)
                            : Math.abs(booking.finalSettlementAmount ?? 0)
                        )}
                      </span>
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <AuditLogList entityType="Booking" entityId={booking._id} />
          </div>
        </TabsContent>
      </Tabs>

      <ReturnBookingDialog
        bookingId={booking._id}
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
      />

      <ConfirmBookingDialog
        bookingId={booking._id}
        summary={{
          totalAmount: booking.totalAmount,
          advancePaid: booking.advancePaid ?? 0,
          securityDeposit: booking.securityDeposit,
        }}
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
      />

      <PickupBookingDialog
        bookingId={booking._id}
        summary={{
          totalAmount: booking.totalAmount,
          advancePaid: booking.advancePaid ?? 0,
          securityDeposit: booking.securityDeposit,
        }}
        open={pickupDialogOpen}
        onOpenChange={setPickupDialogOpen}
      />

      <ServiceOrderFormDialog
        open={dryCleanDialogOpen}
        onOpenChange={setDryCleanDialogOpen}
        products={booking.items
          .filter((item) => item.product)
          .map((item) => ({
            _id: item.product!._id,
            name: item.product!.name,
            sku: item.product!.sku,
          }))}
        editingOrder={null}
        initialValues={dryCleanValues}
      />
    </div>
  );
}
