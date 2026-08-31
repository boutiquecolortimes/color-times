import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/models/Booking";
import { STATUS_LABELS, BOOKING_STATUS_TRANSITIONS } from "@/lib/admin/booking-status";

// Re-exported so existing screens can keep importing both alongside
// BookingStatusBadge from here — the actual maps live in
// lib/admin/booking-status.ts (framework-free) so the API route can share
// them too without pulling this React component into server code.
export { STATUS_LABELS, BOOKING_STATUS_TRANSITIONS };

const STATUS_STYLES: Record<BookingStatus, string> = {
  inquiry: "bg-secondary text-foreground",
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_use: "bg-emerald-100 text-emerald-800",
  returned: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge className={cn("rounded-full border-none font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
