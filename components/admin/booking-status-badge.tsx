import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/models/Booking";

const STATUS_STYLES: Record<BookingStatus, string> = {
  inquiry: "bg-secondary text-foreground",
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_use: "bg-emerald-100 text-emerald-800",
  returned: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
};

// "in_use" is the underlying stored value (unchanged, so existing bookings
// don't need a data migration) — only the label shown to staff changed from
// "In Use" to "Picked Up" per their workflow.
export const STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: "Inquiry",
  pending_payment: "Pending Payment",
  confirmed: "Confirmed",
  in_use: "Picked Up",
  returned: "Returned",
  cancelled: "Cancelled",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge className={cn("rounded-full border-none font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
