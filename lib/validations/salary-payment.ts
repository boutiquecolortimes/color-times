import { z } from "zod";

export const salaryPaymentSchema = z.object({
  staff: z.string().trim().min(1, "Staff member is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  // "YYYY-MM" — which month's salary this payment covers.
  forMonth: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the YYYY-MM format"),
  paymentDate: z.string().trim().min(1, "Payment date is required"),
  paymentMethod: z.enum(["cash", "bank_transfer", "upi", "cheque", "other"]).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type SalaryPaymentInput = z.infer<typeof salaryPaymentSchema>;
