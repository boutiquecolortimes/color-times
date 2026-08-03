import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/validations/phone";

export const STAFF_ROLES = ["staff", "admin", "developer", "super_admin"] as const;

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: optionalPhoneSchema,
  role: z.enum(STAFF_ROLES),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120).optional(),
  phone: optionalPhoneSchema,
  role: z.enum(STAFF_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
