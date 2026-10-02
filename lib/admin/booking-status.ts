import type { BookingStatus } from "@/models/Booking";

// "in_use" is the underlying stored value (unchanged, so existing bookings
// don't need a data migration) — only the label shown to staff changed from
// "In Use" to "Picked Up" per their workflow. Framework-free (no React
// import) so both the client status badge/dropdown and the server-side
// PATCH route can use it for error messages.
export const STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: "Inquiry",
  pending_payment: "Pending Payment",
  confirmed: "Confirmed",
  in_use: "Picked Up",
  returned: "Returned",
  cancelled: "Cancelled",
};

// Which statuses a booking is allowed to move to next, from its current
// status — forward progression only (Inquiry -> Confirmed -> Picked Up ->
// Returned), with Cancel available at any point before the dress actually
// goes out the door and comes back. This mirrors the inventory-release
// logic already in the bookings PATCH route (it frees the dress when
// cancelling from any of these same three states). Shared between the
// status-dropdown UI (components/admin/booking-status-badge.tsx re-exports
// this) and the PATCH route itself, so a stale client or a direct API call
// can't bypass what the picker already prevents. Once a booking is
// Returned or Cancelled, it's final — no reopening it from here.
export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  inquiry: ["confirmed", "cancelled"],
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["in_use", "cancelled"],
  in_use: ["returned", "cancelled"],
  returned: [],
  cancelled: [],
};

/** Why a booking invoice exists, from the stage it was generated/updated at. */
// Sale / Customisation invoice stages (see lib/admin/order-invoices.ts).
const ORDER_STAGE_LABELS: Record<string, string> = {
  sale_created: "Sale Created",
  sale_updated: "Sale Updated",
  order_created: "Order Placed",
  order_updated: "Order Updated",
  payment: "Payment Received",
  pending: "Pending",
  in_progress: "In Progress",
  ready: "Ready",
  delivered: "Delivered",
  return_undone: "Return Undone",
};

export function invoiceStageLabel(stage: string | undefined | null): string | null {
  if (!stage) return null;
  if (stage === "confirmed") return "Booking Confirmed";
  return ORDER_STAGE_LABELS[stage] ?? STATUS_LABELS[stage as BookingStatus] ?? stage;
}

export const INVOICE_STAGE_LABELS_HI: Record<string, string> = {
  inquiry: "पूछताछ",
  pending_payment: "भुगतान बाकी",
  confirmed: "बुकिंग कंफर्म",
  in_use: "ड्रेस पिकअप",
  returned: "ड्रेस वापसी",
  cancelled: "रद्द",
  sale_created: "बिक्री",
  sale_updated: "बिक्री अपडेट",
  order_created: "ऑर्डर",
  order_updated: "ऑर्डर अपडेट",
  payment: "भुगतान प्राप्त",
  pending: "बाकी",
  in_progress: "काम जारी",
  ready: "तैयार",
  delivered: "डिलीवर",
  return_undone: "वापसी रद्द",
};

/**
 * What's still owed on a booking. Once it's returned, any rent left unpaid
 * (plus damage charges) is first taken from the security deposit — only the
 * part the deposit didn't cover is still due. Matches the booking invoice.
 */
export function bookingRemainingDue(booking: {
  status?: string;
  totalAmount: number;
  securityDeposit: number;
  advancePaid?: number;
  damageCharges?: number;
  depositRefundAmount?: number;
}): number {
  const rentTotal = Math.max(0, booking.totalAmount - booking.securityDeposit);
  const paid = Math.max(0, booking.advancePaid ?? 0);
  if (booking.status !== "returned") return Math.max(0, rentTotal - paid);
  const depositUsed = Math.max(0, booking.securityDeposit - (booking.depositRefundAmount ?? 0));
  return Math.max(0, rentTotal + (booking.damageCharges ?? 0) - paid - depositUsed);
}

/** Part of the security deposit kept (used for rent / damage) at return. */
export function bookingDepositUsed(booking: {
  status?: string;
  securityDeposit: number;
  depositRefundAmount?: number;
}): number {
  if (booking.status !== "returned") return 0;
  return Math.max(0, booking.securityDeposit - (booking.depositRefundAmount ?? 0));
}
