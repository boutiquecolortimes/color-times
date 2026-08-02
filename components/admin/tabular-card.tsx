import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabularCardRow {
  key: string;
  label: string;
  sublabel?: string;
  value: string;
  secondaryValue?: string;
  /** 0-100. Renders a proportional bar under the row against the largest row. */
  percent?: number;
  color?: string;
  icon?: LucideIcon;
}

interface TabularCardProps {
  title: string;
  subtitle?: string;
  rows: TabularCardRow[];
  emptyMessage?: string;
  footer?: ReactNode;
  className?: string;
}

const DEFAULT_BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function TabularCard({
  title,
  subtitle,
  rows,
  emptyMessage = "No data yet for this period.",
  footer,
  className,
}: TabularCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {footer}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="mt-4 space-y-3.5">
          {rows.map((row, index) => {
            const Icon = row.icon;
            const barColor = row.color ?? DEFAULT_BAR_COLORS[index % DEFAULT_BAR_COLORS.length];
            return (
              <div key={row.key}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {Icon ? (
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
                        style={{ background: `color-mix(in oklch, ${barColor} 16%, transparent)` }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: barColor }} strokeWidth={2} />
                      </span>
                    ) : (
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                        style={{ background: barColor }}
                      >
                        {index + 1}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.label}</p>
                      {row.sublabel && (
                        <p className="truncate text-xs text-muted-foreground">{row.sublabel}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{row.value}</p>
                    {row.secondaryValue && (
                      <p className="text-xs text-muted-foreground">{row.secondaryValue}</p>
                    )}
                  </div>
                </div>
                {row.percent !== undefined && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(2, Math.min(100, row.percent))}%`,
                        background: barColor,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
