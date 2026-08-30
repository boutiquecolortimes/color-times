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

// A "parcel" is one dealer bill covering multiple dresses at once (e.g. a
// ₹2L delivery of 15 pieces) — entered on its own full page instead of the
// single-item popup above. Each line either restocks a dress already in the
// catalog, or hands over just enough detail to create a brand-new one on the
// spot (name/category/cost/size — photos and final pricing are filled in
// later on the product's own page, same as Quick Add elsewhere in Products).
export const purchaseParcelLineSchema = z.object({
  mode: z.enum(["existing", "new"]),
  // mode: "existing"
  product: z.string().trim().optional().or(z.literal("")),
  // mode: "new"
  name: z.string().trim().max(150).optional().or(z.literal("")),
  category: z.string().trim().optional().or(z.literal("")),
  color: z.string().trim().max(60).optional().or(z.literal("")),
  fabric: z.string().trim().max(60).optional().or(z.literal("")),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  rentalPricePerDay: z.number().min(0).optional(),
  // Shared by both modes
  variantSize: z.string().trim().max(40).optional().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0, "Unit cost must be 0 or more"),
});

export const purchaseParcelSchema = z
  .object({
    billNumber: z.string().trim().min(1, "Bill number is required").max(60),
    vendorName: z.string().trim().min(1, "Dealer name is required").max(150),
    vendorContact: z.string().trim().max(40).optional().or(z.literal("")),
    purchaseDate: z.string().trim().min(1, "Purchase date is required"),
    paymentStatus: z.enum(["paid", "pending", "partial"]).optional(),
    amountPaid: z.number().min(0).optional(),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    items: z.array(purchaseParcelLineSchema).min(1, "Add at least one product"),
  })
  .refine((data) => data.items.every((item) => item.mode !== "existing" || item.product), {
    message: "Select a product for each existing-dress line",
    path: ["items"],
  })
  .refine((data) => data.items.every((item) => item.mode !== "new" || item.name), {
    message: "Enter a name for each new-product line",
    path: ["items"],
  })
  .refine((data) => data.items.every((item) => item.mode !== "new" || item.category), {
    message: "Choose a category for each new-product line",
    path: ["items"],
  });

export type PurchaseParcelInput = z.infer<typeof purchaseParcelSchema>;
export type PurchaseParcelLineInput = z.infer<typeof purchaseParcelLineSchema>;
