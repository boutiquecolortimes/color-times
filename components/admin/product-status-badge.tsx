import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/models/Product";

const STATUS_STYLES: Record<ProductStatus, string> = {
  available: "bg-emerald-100 text-emerald-800",
  booked: "bg-blue-100 text-blue-800",
  reserved: "bg-blue-100 text-blue-800",
  picked_up: "bg-indigo-100 text-indigo-800",
  under_dry_cleaning: "bg-amber-100 text-amber-800",
  under_repair: "bg-orange-100 text-orange-800",
  damaged: "bg-red-100 text-red-800",
  returned: "bg-slate-200 text-slate-700",
  sold: "bg-purple-100 text-purple-800",
};

const STATUS_LABELS: Record<ProductStatus, string> = {
  available: "Available",
  booked: "Reserved",
  reserved: "Reserved",
  picked_up: "Picked Up",
  under_dry_cleaning: "Dry Cleaning",
  under_repair: "Repair",
  damaged: "Damaged",
  returned: "Returned",
  sold: "Sold",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge className={cn("rounded-full border-none font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
