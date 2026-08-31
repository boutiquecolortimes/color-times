import type { BookingStatus } from "@/models/Booking";

// "in_use" is the underlying stored value (unchanged, so existing bookings
// don't need a data migration) — only the label shown to staff changed from
// "In Use" to "Picked Up" per their workflow. Framework-free (no React
// import) so both the client status badge/dropdown and the server-side
// PATCH route can use it for error messages.
export const STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: "Inquiry",
  pending_payment: "Pending Payment",
  confirmed: "Confirmed",
  in_use: "Picked Up",
  returned: "Returned",
  cancelled: "Cancelled",
};

// Which statuses a booking is allowed to move to next, from its current
// status — forward progression only (Inquiry -> Confirmed -> Picked Up ->
// Returned), with Cancel available at any point before the dress actually
// goes out the door and comes back. This mirrors the inventory-release
// logic already in the bookings PATCH route (it frees the dress when
// cancelling from any of these same three states). Shared between the
// status-dropdown UI (components/admin/booking-status-badge.tsx re-exports
// this) and the PATCH route itself, so a stale client or a direct API call
// can't bypass what the picker already prevents. Once a booking is
// Returned or Cancelled, it's final — no reopening it from here.
export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  inquiry: ["confirmed", "cancelled"],
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["in_use", "cancelled"],
  in_use: ["returned", "cancelled"],
  returned: [],
  cancelled: [],
};
