import { z } from "zod";
import { phoneSchema } from "@/lib/validations/phone";

export const saleSchema = z.object({
  saleDate: z.string().min(1, "Sale date is required"),
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerPhone: phoneSchema,
  customerAddress: z.string().trim().min(1, "Address is required"),
  // Set when the sale is created against a real customer via the picker —
  // lets the customer's own profile page show this as real order history.
  customer: z.string().trim().optional().or(z.literal("")),
  product: z.string().min(1, "Select a product"),
  details: z.string().trim().optional(),
  totalAmount: z.number().min(0),
});

export type SaleInput = z.infer<typeof saleSchema>;

export const saleUpdateSchema = saleSchema.partial();

export type SaleUpdateInput = z.infer<typeof saleUpdateSchema>;
