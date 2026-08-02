import { Skeleton } from "@/components/ui/skeleton";

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function ChartPanelSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-24" />
      <Skeleton className={tall ? "mt-4 h-[280px] w-full" : "mt-4 h-56 w-full"} />
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} className={col === 0 ? "h-4 flex-[1.4]" : "h-4 flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3.5 w-60" />
      </div>
      <Skeleton className="h-9 w-28 rounded-lg" />
    </div>
  );
}

export function ListPageSkeleton({
  rows = 8,
  columns = 5,
  showStats = false,
}: {
  rows?: number;
  columns?: number;
  showStats?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {showStats && <StatCardsSkeleton />}
      <TableSkeleton rows={rows} columns={columns} />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-36" />
      <div className="rounded-lg border border-border bg-card p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-3.5 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-6 w-20" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={4} columns={5} />
    </div>
  );
}

export function FormPageSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-36" />
      <div className="max-w-2xl space-y-5 rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartPanelSkeleton tall />
        </div>
        <div className="lg:col-span-2">
          <ChartPanelSkeleton tall />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-48" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
          <div className="mt-4 space-y-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                  <Skeleton className="h-3.5 w-10" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-72" />
        <ChartPanelSkeleton tall />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartPanelSkeleton />
          <ChartPanelSkeleton />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-5 w-56" />
        <StatCardsSkeleton count={4} />
      </div>
    </div>
  );
}

/** For Sheet/Dialog detail views that fetch data after opening (product drawer, booking quick view). */
export function SheetDetailSkeleton() {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-20 shrink-0 rounded-md" />
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1 rounded-md" />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg border border-border p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** For a small set of dialog fields/inputs that populate after an open-time fetch. */
export function DialogFieldsSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
