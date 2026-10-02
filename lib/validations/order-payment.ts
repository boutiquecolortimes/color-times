import { z } from "zod";

// "Collect payment" on a sale / customisation order. amount may be 0 only
// when marking a customisation order Delivered with nothing left to pay.
export const orderPaymentSchema = z
  .object({
    amount: z.number().min(0),
    method: z.enum(["cash", "card", "upi", "bank_transfer", "other"]),
    reference: z.string().trim().max(100).optional(),
    note: z.string().trim().max(200).optional(),
    markDelivered: z.boolean().optional(),
  })
  .refine((input) => input.amount > 0 || input.markDelivered, {
    message: "Enter the amount received",
    path: ["amount"],
  });

export type OrderPaymentInput = z.infer<typeof orderPaymentSchema>;
