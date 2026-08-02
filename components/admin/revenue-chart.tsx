"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RevenueChartProps {
  data: { label: string; revenue: number; bookings: number }[];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const bookings = payload.find((p) => p.dataKey === "bookings")?.value ?? 0;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--gold)" }} />
        Revenue: <span className="font-medium text-foreground">₹{revenue.toLocaleString("en-IN")}</span>
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-3)" }} />
        Bookings: <span className="font-medium text-foreground">{bookings.toLocaleString("en-IN")}</span>
      </p>
    </div>
  );
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No revenue data yet for this period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          yAxisId="revenue"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickFormatter={(value: number) => `₹${(value / 1000).toFixed(0)}k`}
          width={48}
        />
        <YAxis yAxisId="bookings" hide />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--secondary)", opacity: 0.4 }} />
        <Bar
          yAxisId="bookings"
          dataKey="bookings"
          fill="var(--chart-3)"
          fillOpacity={0.22}
          radius={[4, 4, 0, 0]}
          barSize={22}
        />
        <Area
          yAxisId="revenue"
          type="monotone"
          dataKey="revenue"
          stroke="var(--gold)"
          strokeWidth={2.5}
          fill="url(#revenueFill)"
          dot={{ r: 3, fill: "var(--gold)", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "var(--gold)", strokeWidth: 2, stroke: "var(--card)" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
