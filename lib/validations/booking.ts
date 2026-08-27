import { z } from "zod";
import { measurementsZodSchema } from "@/lib/validations/measurements";

export const bookingStatusSchema = z.object({
  status: z.enum(["inquiry", "pending_payment", "confirmed", "in_use", "returned", "cancelled"]),
  // Lets staff correct the security deposit actually held (e.g. it was
  // topped up, or only partially collected at booking time) at the moment a
  // booking is marked returned. When sent, the refund/settlement math below
  // is computed against this value instead of always trusting whatever was
  // recorded back when the booking was first created.
  securityDeposit: z.number().min(0).optional(),
  returnCondition: z.enum(["good", "minor_damage", "major_damage", "missing_items"]).optional(),
  returnNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  dryCleaningRequired: z.boolean().optional(),
  stitchingRequired: z.boolean().optional(),
  damageCharges: z.number().min(0).optional(),
  pendingRentAmount: z.number().min(0).optional(),
  depositRefunded: z.boolean().optional(),
  // Amount collected from the customer at pickup — added on top of whatever
  // advance is already paid, not a replacement for it. Pickup now collects
  // the full outstanding due (not just a security top-up), so an invoice is
  // generated right after this status change goes through.
  pickupPaymentAmount: z.number().min(0).optional(),
});

export type BookingStatusInput = z.infer<typeof bookingStatusSchema>;

/**
 * Nets the security deposit held against damage + any unpaid rent.
 * finalSettlementAmount > 0 means the customer still owes that much beyond the deposit;
 * < 0 means that amount is owed back to the customer as a refund.
 */
export function computeBookingSettlement(input: {
  securityDeposit: number;
  damageCharges: number;
  pendingRentAmount: number;
}): { depositRefundAmount: number; finalSettlementAmount: number } {
  const amountOwed = input.damageCharges + input.pendingRentAmount;
  const netPosition = amountOwed - input.securityDeposit;
  const depositRefundAmount = netPosition < 0 ? -netPosition : 0;
  return { depositRefundAmount, finalSettlementAmount: netPosition };
}

export const bookingItemSchema = z.object({
  product: z.string().trim().min(1, "Dress is required"),
  // Size/quantity aren't collected in the booking form anymore — the API
  // fills them in (one unit, the product's first size) so older reporting
  // code that expects them keeps working. Color and rent are shown and are
  // editable per line, defaulting to the product's own values.
  color: z.string().trim().optional().or(z.literal("")),
  pricePerDay: z.number().min(0).optional(),
  // Per-item wearer + measurements — one booking can cover several people
  // (e.g. 5 girls, 5 dresses), each with their own figure against their own dress.
  wearerName: z.string().trim().max(120).optional().or(z.literal("")),
  measurements: measurementsZodSchema.optional(),
});

export type BookingItemInput = z.infer<typeof bookingItemSchema>;

const bookingFieldsSchema = z.object({
  customer: z.string().trim().min(1, "Customer is required"),
  // Required + duplicate-checked server-side (see the bookings POST/PATCH
  // routes) — pre-filled on the New Booking form with the next sequential
  // number (see suggestNextBillNumber()), but staff can override it, e.g.
  // while bulk-entering the client's historical records.
  billNumber: z.string().trim().min(1, "Bill number is required").max(50),
  bookingDate: z.string().trim().min(1, "Booking date is required"),
  items: z.array(bookingItemSchema).min(1, "Add at least one item"),
  rentalStartDate: z.string().trim().min(1, "Rental start date is required"),
  rentalEndDate: z.string().trim().min(1, "Rental end date is required"),
  // No longer collected in the form — the API defaults it to the pickup date.
  eventDate: z.string().trim().optional().or(z.literal("")),
  deliveryAddress: z.string().trim().optional().or(z.literal("")),
  // Editable override; the API sums the selected dresses' deposits as the
  // suggested default when this isn't sent.
  securityDeposit: z.number().min(0).optional(),
  advancePaid: z.number().min(0).optional(),
  // Free text (validated against the admin-editable list client-side, not
  // a fixed enum here) so new payment methods don't need a schema change.
  advancePaymentMethod: z.string().trim().max(40).optional().or(z.literal("")),
  measurements: measurementsZodSchema.optional(),
  notes: z.string().trim().optional().or(z.literal("")),
});

export const bookingCreateSchema = bookingFieldsSchema.refine(
  (data) => new Date(data.rentalEndDate) >= new Date(data.rentalStartDate),
  {
    message: "Rental end date must be on or after the start date",
    path: ["rentalEndDate"],
  }
);

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

// Same fields as create, but used to edit an existing booking — the form
// always resubmits every field (it's the same controlled form as Create),
// so this stays a full object rather than .partial(); it's a separate
// schema only so the date-order check can share the base fields cleanly.
export const bookingUpdateSchema = bookingFieldsSchema.refine(
  (data) => new Date(data.rentalEndDate) >= new Date(data.rentalStartDate),
  {
    message: "Rental end date must be on or after the start date",
    path: ["rentalEndDate"],
  }
);

export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
