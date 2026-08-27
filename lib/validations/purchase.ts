import { z } from "zod";

export const purchaseSchema = z.object({
  itemName: z.string().trim().min(1, "Item name is required").max(150),
  vendorName: z.string().trim().min(1, "Vendor name is required").max(150),
  vendorContact: z.string().trim().max(40).optional().or(z.literal("")),
  // Optional link to an existing dress — when set together with
  // addToStock, the purchase bumps that product's variant stock.
  product: z.string().trim().optional().or(z.literal("")),
  variantSize: z.string().trim().max(40).optional().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0, "Unit cost must be 0 or more"),
  purchaseDate: z.string().trim().min(1, "Purchase date is required"),
  paymentStatus: z.enum(["paid", "pending", "partial"]).optional(),
  amountPaid: z.number().min(0).optional(),
  addToStock: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
