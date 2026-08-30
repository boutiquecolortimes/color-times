import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Escapes regex special characters so a string can be used as a literal match pattern. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Turns a name into a URL-safe slug, e.g. "Red Silk Saree" -> "red-silk-saree". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/** Formats a date as "10-Jul-2026". */
export function formatDate(value: string | number | Date): string {
  const date = new Date(value)
  const day = String(date.getDate()).padStart(2, "0")
  const month = date.toLocaleDateString("en-IN", { month: "short" })
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

/** Formats a date with time as "10-Jul-2026, 2:30 PM". */
export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value)
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  return `${formatDate(date)}, ${time}`
}

// Walk-in bookings don't collect a real email, so a quick-add customer gets
// a generated placeholder like "9876543210.1712345678901@walkin.vchuki.local"
// just to satisfy the unique/required email field — never something to show
// an admin as if it were a real contact address.
const WALKIN_EMAIL_PATTERN = /@walkin\.[a-z0-9.-]+$/i

/** True for the auto-generated placeholder email walk-in customers get instead of a real one. */
export function isWalkinEmail(email?: string | null): boolean {
  return Boolean(email) && WALKIN_EMAIL_PATTERN.test(email as string)
}

/**
 * The best contact detail to show under a customer's name: their real email,
 * or their phone number when the "email" on file is just the walk-in
 * placeholder, or a plain label when neither is available.
 */
export function customerContact(customer: { email?: string | null; phone?: string | null }): string {
  if (customer.email && !isWalkinEmail(customer.email)) return customer.email
  return customer.phone || "Walk-in customer"
}

/** Inclusive day count between two dates (same-day rentals count as 1 day). */
export function daysBetween(from: string | Date, to: string | Date): number {
  if (!from || !to) return 0
  const start = new Date(from)
  const end = new Date(to)
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff + 1)
}
