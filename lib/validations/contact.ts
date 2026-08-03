import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/validations/phone";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: optionalPhoneSchema,
  reason: z.enum(["general", "booking_inquiry", "partnership", "support"]),
  message: z.string().trim().min(10, "Tell us a little more (min 10 characters)").max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;
