import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttentionCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  href: string;
  /** true = there's something outstanding here and it should read as a flag; false = all clear. */
  active: boolean;
  hint?: string;
}

/**
 * A single tile in the dashboard's "Needs Attention" strip — distinct from
 * StatCard on purpose: these are click-through action items (things with a
 * queue behind them), not reference numbers, so they carry a warning tint
 * when non-zero and a calm one when the queue is empty.
 */
export function AttentionCard({ label, value, icon: Icon, href, active, hint }: AttentionCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border p-4 transition-colors",
        active
          ? "border-chart-4/25 bg-chart-4/5 hover:border-chart-4/45 hover:bg-chart-4/10"
          : "border-border bg-card hover:border-chart-3/35 hover:bg-chart-3/5"
      )}
    >
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
          active ? "bg-chart-4/15 text-chart-4" : "bg-chart-3/12 text-chart-3"
        )}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-xl leading-none">{value}</p>
        <p className="mt-1.5 truncate text-xs text-muted-foreground">{label}</p>
        {hint && <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">{hint}</p>}
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 self-start text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
