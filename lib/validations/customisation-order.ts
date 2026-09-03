import { z } from "zod";
import { measurementsZodSchema } from "@/lib/validations/measurements";
import { phoneSchema } from "@/lib/validations/phone";

export const customisationOrderSchema = z.object({
  orderDate: z.string().min(1, "Order date is required"),
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerPhone: phoneSchema,
  customerAddress: z.string().trim().min(1, "Address is required"),
  // Set when the order is created against a real customer via the picker —
  // lets the customer's own profile page show this as real order history.
  customer: z.string().trim().optional().or(z.literal("")),
  stitchingType: z.string().trim().min(1, "Stitching type is required"),
  detail: z.string().trim().min(1, "Detail is required"),
  measurements: measurementsZodSchema.optional(),
  totalAmount: z.number().min(0),
  advancePayment: z.number().min(0),
  notes: z.string().trim().optional(),
});

export type CustomisationOrderInput = z.infer<typeof customisationOrderSchema>;

export function computeCustomisationDue(input: {
  totalAmount: number;
  advancePayment: number;
}): number {
  return Math.max(0, input.totalAmount - input.advancePayment);
}

export const customisationStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "ready", "delivered", "cancelled"]),
});

export const customisationOrderUpdateSchema = customisationOrderSchema.partial().extend({
  status: z.enum(["pending", "in_progress", "ready", "delivered", "cancelled"]).optional(),
});

export type CustomisationOrderUpdateInput = z.infer<typeof customisationOrderUpdateSchema>;
