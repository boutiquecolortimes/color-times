import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required"),
  description: z.string().trim().max(500).optional(),
  // Not set from the admin form anymore — auto-derived on the storefront,
  // kept optional so older callers (scripts, imports) can still pass one.
  heroImage: z.string().trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isFeatured: z.boolean().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
