"use client";

import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Shown above a list opened from a dashboard "Needs Attention" card, so it's
 * clear the list is filtered. "Show all" drops the filter and the URL param.
 */
export function AttentionFilterBanner({ label, onClear }: { label: string; onClear: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm">
      <span>
        <span className="text-muted-foreground">Showing: </span>
        <span className="font-medium">{label}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          onClear();
          router.replace(pathname);
        }}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent/20"
      >
        <X className="h-3.5 w-3.5" />
        Show all
      </button>
    </div>
  );
}
