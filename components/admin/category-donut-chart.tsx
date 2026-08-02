"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface CategoryDonutChartProps {
  data: { category: string; bookings: number }[];
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{entry.name}</p>
      <p className="mt-0.5 text-muted-foreground">
        {entry.value} bookings <span className="text-foreground">({percent}%)</span>
      </p>
    </div>
  );
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No bookings yet this month.
      </div>
    );
  }

  const total = data.reduce((sum, entry) => sum + entry.bookings, 0);

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="bookings"
              nameKey="category"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={entry.category} fill={COLORS[index % COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-heading text-2xl">{total.toLocaleString("en-IN")}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bookings</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {data.map((entry, index) => {
          const percent = total > 0 ? Math.round((entry.bookings / total) * 100) : 0;
          return (
            <div key={entry.category} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: COLORS[index % COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground">{entry.category}</span>
              <span className="shrink-0 text-muted-foreground">{entry.bookings}</span>
              <span className="w-10 shrink-0 text-right font-medium text-foreground">{percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
