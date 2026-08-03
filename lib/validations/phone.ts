import { z } from "zod";

/** Indian mobile numbers: exactly 10 digits, starting with 6-9. */
export const MOBILE_REGEX = /^[6-9]\d{9}$/;

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Required mobile number field — strips formatting, then enforces a valid 10-digit number. */
export const phoneSchema = z
  .string()
  .trim()
  .transform(stripNonDigits)
  .refine((value) => MOBILE_REGEX.test(value), "Enter a valid 10-digit mobile number");

/** Optional mobile number field — empty stays empty, anything else must be a valid 10-digit number. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform(stripNonDigits)
  .refine((value) => value === "" || MOBILE_REGEX.test(value), "Enter a valid 10-digit mobile number")
  .optional()
  .or(z.literal(""));
