"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardAnalytics } from "@/components/admin/dashboard-analytics";
import { ChartPanelSkeleton } from "@/components/admin/page-skeletons";
import { DATE_RANGE_PRESETS, DATE_RANGE_LABELS, type DateRangePreset } from "@/lib/admin/date-ranges";
import type { DashboardAnalytics as DashboardAnalyticsData } from "@/lib/admin/dashboard-stats";

async function fetchAnalytics(params: {
  preset: DateRangePreset;
  from: string;
  to: string;
}): Promise<{ analytics: DashboardAnalyticsData; rangeLabel: string }> {
  const searchParams = new URLSearchParams({ preset: params.preset });
  if (params.preset === "custom") {
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
  }
  const res = await fetch(`/api/admin/dashboard/analytics?${searchParams.toString()}`);
  const json = await res.json().catch(() => ({ error: "Unexpected response from server" }));
  if (!res.ok) throw new Error(json.error ?? "Failed to load analytics");
  return json.data;
}

export function DashboardAnalyticsPanel() {
  const [preset, setPreset] = useState<DateRangePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["admin", "dashboard-analytics", { preset, customFrom, customTo }],
    queryFn: () => fetchAnalytics({ preset, from: customFrom, to: customTo }),
    enabled: preset !== "custom" || Boolean(customFrom && customTo),
    retry: 1,
  });

  const analytics = data?.analytics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={preset} onValueChange={(value) => setPreset((value as DateRangePreset) ?? "all")}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue>{(value: DateRangePreset) => DATE_RANGE_LABELS[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_PRESETS.map((option) => (
              <SelectItem key={option} value={option}>
                {DATE_RANGE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {preset === "custom" && (
          <>
            <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="From" />
            <span className="text-sm text-muted-foreground">to</span>
            <DatePicker value={customTo} onChange={setCustomTo} placeholder="To" />
          </>
        )}

        {data?.rangeLabel && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Showing {data.rangeLabel}
            {isFetching && !isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </p>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium">Couldn&apos;t load analytics</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Something went wrong. Please try again."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : isLoading || !analytics ? (
        <div className="space-y-6">
          <ChartPanelSkeleton tall />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartPanelSkeleton />
            <ChartPanelSkeleton />
          </div>
        </div>
      ) : (
        <DashboardAnalytics
          bookingStatusBreakdown={analytics.bookingStatusBreakdown}
          invoiceStatusBreakdown={analytics.invoiceStatusBreakdown}
          categoryRevenue={analytics.categoryRevenue}
          topProducts={analytics.topProducts}
          monthlyTrend={analytics.monthlyTrend}
        />
      )}
    </div>
  );
}
