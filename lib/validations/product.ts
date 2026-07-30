import { z } from "zod";

export const productVariantSchema = z.object({
  // Free text — the form has a plain input instead of a fixed size dropdown.
  size: z.string().trim().min(1, "Size is required"),
  quantityInStock: z.number().int().min(0),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  slug: z.string().trim().toLowerCase().min(1, "Slug is required"),
  sku: z.string().trim().toUpperCase().min(1, "Code is required"),
  category: z.string().trim().min(1, "Category is required"),
  designer: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  color: z.string().trim().optional().or(z.literal("")),
  fabric: z.string().trim().optional().or(z.literal("")),
  dressType: z.string().trim().max(80).optional().or(z.literal("")),
  work: z.string().trim().max(120).optional().or(z.literal("")),
  // No minimum here on purpose — leaving Images/Other untouched shouldn't
  // silently block Save. The API fills in sensible defaults (a placeholder
  // image, one M-size variant at 0 stock) when these come back empty.
  images: z.array(z.string()),
  variants: z.array(productVariantSchema),
  status: z
    .enum([
      "available",
      "booked",
      "reserved",
      "picked_up",
      "under_dry_cleaning",
      "under_repair",
      "damaged",
      "returned",
    ])
    .optional(),
  rentalPricePerDay: z.number().min(0),
  // Retail value and security deposit no longer appear on the Pricing tab —
  // when omitted the API auto-derives them from rentalPricePerDay.
  retailValue: z.number().min(0).optional(),
  securityDeposit: z.number().min(0).optional(),
  purchasePrice: z.number().min(0).optional(),
  stitchingCost: z.number().min(0).optional(),
  transportCost: z.number().min(0).optional(),
  isFeatured: z.boolean(),
  isNewArrival: z.boolean(),
  isActive: z.boolean(),
  tags: z.array(z.string()),
});

export type ProductInput = z.infer<typeof productSchema>;
