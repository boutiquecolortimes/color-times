import { z } from "zod";
import { measurementsZodSchema } from "@/lib/validations/measurements";

export const bookingStatusSchema = z.object({
  status: z.enum(["inquiry", "pending_payment", "confirmed", "in_use", "returned", "cancelled"]),
  returnCondition: z.enum(["good", "minor_damage", "major_damage", "missing_items"]).optional(),
  returnNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  dryCleaningRequired: z.boolean().optional(),
  stitchingRequired: z.boolean().optional(),
  damageCharges: z.number().min(0).optional(),
  pendingRentAmount: z.number().min(0).optional(),
  depositRefunded: z.boolean().optional(),
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
});

export type BookingItemInput = z.infer<typeof bookingItemSchema>;

export const bookingCreateSchema = z
  .object({
    customer: z.string().trim().min(1, "Customer is required"),
    billNumber: z.string().trim().max(50).optional().or(z.literal("")),
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
    measurements: measurementsZodSchema.optional(),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => new Date(data.rentalEndDate) >= new Date(data.rentalStartDate), {
    message: "Rental end date must be on or after the start date",
    path: ["rentalEndDate"],
  });

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
