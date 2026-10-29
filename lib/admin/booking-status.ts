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
/**
 * Money received is applied to rent first; anything paid beyond the rent is
 * the customer's security deposit (refundable at Return). Returns the
 * security deposit a booking must record so that extra is never lost — the
 * larger of the deposit already on file and the over-payment.
 *
 * E.g. rent ₹1,700, customer pays ₹2,000 at booking → security ₹300.
 */
export function securityIncludingExcess(
  rentTotal: number,
  amountPaid: number,
  securityOnFile: number
): number {
  return Math.max(0, securityOnFile, amountPaid - rentTotal);
}

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

type DepositFields = {
  status?: string;
  totalAmount: number;
  securityDeposit: number;
  advancePaid?: number;
  depositRefundAmount?: number;
  depositRefunded?: boolean;
};

/**
 * Security money physically still with the boutique for this booking.
 *   before Return — whatever was paid beyond the rent, capped at the deposit
 *                   (the deposit is collected at Pickup, after rent)
 *   Returned      — the refund still owed to the customer, until it's handed back;
 *                   the part kept for rent/damage became income, so it isn't "held"
 *   Cancelled     — nothing
 * Must stay in step with the $switch in lib/admin/bookings-summary.ts.
 */
export function bookingDepositHeld(booking: DepositFields): number {
  if (booking.status === "cancelled") return 0;
  if (booking.status === "returned") {
    return booking.depositRefunded ? 0 : Math.max(0, booking.depositRefundAmount ?? 0);
  }
  const rentTotal = Math.max(0, booking.totalAmount - booking.securityDeposit);
  const paidBeyondRent = Math.max(0, (booking.advancePaid ?? 0) - rentTotal);
  return Math.min(booking.securityDeposit, paidBeyondRent);
}

export type DepositState = "none" | "not_collected" | "held" | "refund_pending" | "refunded" | "kept";

/** Where the deposit stands, for the Security column badge. */
export function bookingDepositState(booking: DepositFields): DepositState {
  if (booking.securityDeposit <= 0 || booking.status === "cancelled") return "none";
  if (booking.status === "returned") {
    if ((booking.depositRefundAmount ?? 0) <= 0) return "kept";
    return booking.depositRefunded ? "refunded" : "refund_pending";
  }
  return bookingDepositHeld(booking) > 0 ? "held" : "not_collected";
}

/**
 * Splits what's been paid on a booking for display:
 *   advance  — paid before pickup
 *   duePaid  — the rent part of what was paid at/after pickup
 *   security — the rest of it: the deposit, held and refunded at Return
 * Money goes to rent first, so the deposit never shows up as rent paid.
 */
export function bookingPaidBreakdown(booking: {
  totalAmount: number;
  securityDeposit: number;
  advancePaid?: number;
  pickupPaid?: number;
}): { advance: number; duePaid: number; securityHeld: number } {
  const rentTotal = Math.max(0, booking.totalAmount - booking.securityDeposit);
  const totalPaid = Math.max(0, booking.advancePaid ?? 0);
  const pickup = Math.min(totalPaid, Math.max(0, booking.pickupPaid ?? 0));
  const advance = totalPaid - pickup;
  const duePaid = Math.min(pickup, Math.max(0, rentTotal - advance));
  return { advance, duePaid, securityHeld: Math.max(0, totalPaid - rentTotal) };
}
