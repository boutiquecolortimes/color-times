import { z } from "zod";

export const productVariantSchema = z.object({
  size: z.enum(["XS", "S", "M", "L", "XL", "XXL", "Custom"]),
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
  images: z.array(z.string()).min(1, "At least one image is required"),
  variants: z.array(productVariantSchema).min(1, "At least one size is required"),
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
