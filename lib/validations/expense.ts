import { z } from "zod";

export const expenseSchema = z.object({
  category: z.enum([
    "rent",
    "electricity",
    "water",
    "maintenance",
    "transport",
    "marketing",
    "office_supplies",
    "miscellaneous",
  ]),
  description: z.string().trim().min(1, "Description is required").max(200),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  expenseDate: z.string().trim().min(1, "Expense date is required"),
  paymentMethod: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
