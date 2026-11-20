/**
 * Filters behind the dashboard's "Needs Attention" cards. Each card links to
 * its list with ?attention=<key>, and the list API applies the same rule the
 * dashboard counted with (lib/admin/dashboard-stats.ts uses these too), so
 * the number on the card and the rows in the list always match.
 * Framework-free: the list clients import the labels from here.
 */

export const BOOKING_ATTENTION_LABELS = {
  returns_overdue: "Returns overdue: past their return date",
  pickups_today: "Pickups today",
  returns_due_today: "Returns due today",
} as const;
export type BookingAttention = keyof typeof BOOKING_ATTENTION_LABELS;

export const INVOICE_ATTENTION_LABELS = {
  overdue: "Overdue invoices: past their due date with money still owed",
} as const;
export type InvoiceAttention = keyof typeof INVOICE_ATTENTION_LABELS;

export const PRODUCT_ATTENTION_LABELS = {
  low_stock: "Low stock: at or below the reorder threshold",
} as const;
export type ProductAttention = keyof typeof PRODUCT_ATTENTION_LABELS;

export function isBookingAttention(value: string | null | undefined): value is BookingAttention {
  return Boolean(value && value in BOOKING_ATTENTION_LABELS);
}
export function isInvoiceAttention(value: string | null | undefined): value is InvoiceAttention {
  return Boolean(value && value in INVOICE_ATTENTION_LABELS);
}
export function isProductAttention(value: string | null | undefined): value is ProductAttention {
  return Boolean(value && value in PRODUCT_ATTENTION_LABELS);
}

/** Start of today and of tomorrow, the same day boundary the dashboard uses. */
export function todayBounds(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function bookingAttentionFilter(key: BookingAttention, now: Date = new Date()): Record<string, unknown> {
  const { start, end } = todayBounds(now);
  switch (key) {
    case "returns_overdue":
      return { status: { $in: ["confirmed", "in_use"] }, rentalEndDate: { $lt: now } };
    case "pickups_today":
      return { status: { $ne: "cancelled" }, rentalStartDate: { $gte: start, $lt: end } };
    case "returns_due_today":
      return { status: { $ne: "cancelled" }, rentalEndDate: { $gte: start, $lt: end } };
  }
}

export function invoiceAttentionFilter(key: InvoiceAttention, now: Date = new Date()): Record<string, unknown> {
  switch (key) {
    case "overdue":
      return { status: { $in: ["sent", "partially_paid"] }, dueDate: { $lt: now } };
  }
}
