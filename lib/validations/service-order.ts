import { z } from "zod";

const serviceOrderBaseSchema = z.object({
  serviceType: z.enum(["dry_clean", "tailor"]),
  product: z.string().min(1, "Select a product"),
  booking: z.string().optional().nullable(),
  // Free-text booking bill number reference, for direct-creation orders
  // that have no formal Booking link (see models/ServiceOrder.ts).
  bookingBillNumberRef: z.string().trim().max(50).optional(),
  description: z.string().trim().min(1, "Description is required").max(500),
  dryCleanCharge: z.number().min(0).optional(),
  ironCharge: z.number().min(0).optional(),
  stitchingCharge: z.number().min(0).optional(),
  stitchingType: z.string().trim().optional(),
  otherCharge: z.number().min(0).optional(),
  assignedTo: z.string().trim().optional(),
  sentDate: z.string().min(1, "Sent date is required"),
  expectedReturnDate: z.string().min(1, "Expected return date is required"),
  notes: z.string().trim().optional(),
});

export const serviceOrderSchema = serviceOrderBaseSchema.superRefine((input, ctx) => {
  if (input.serviceType === "dry_clean") {
    if (input.dryCleanCharge === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["dryCleanCharge"],
        message: "Dry clean charge is required",
      });
    }
    if (input.ironCharge === undefined) {
      ctx.addIssue({ code: "custom", path: ["ironCharge"], message: "Iron charge is required" });
    }
  } else {
    if (input.stitchingCharge === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["stitchingCharge"],
        message: "Stitching charge is required",
      });
    }
    if (!input.stitchingType) {
      ctx.addIssue({
        code: "custom",
        path: ["stitchingType"],
        message: "Stitching type is required",
      });
    }
  }
});

export type ServiceOrderInput = z.infer<typeof serviceOrderBaseSchema>;

export function computeServiceOrderTotal(input: {
  serviceType: "dry_clean" | "tailor";
  dryCleanCharge?: number;
  ironCharge?: number;
  stitchingCharge?: number;
  otherCharge?: number;
}): number {
  const other = input.otherCharge ?? 0;
  if (input.serviceType === "dry_clean") {
    return (input.dryCleanCharge ?? 0) + (input.ironCharge ?? 0) + other;
  }
  return (input.stitchingCharge ?? 0) + other;
}

export const serviceOrderStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "quality_check", "completed", "cancelled"]),
});

export const serviceOrderUpdateSchema = serviceOrderBaseSchema.partial().extend({
  status: z.enum(["pending", "in_progress", "quality_check", "completed", "cancelled"]).optional(),
});

export type ServiceOrderUpdateInput = z.infer<typeof serviceOrderUpdateSchema>;
