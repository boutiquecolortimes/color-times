"use client";

// Phone-only bar above list cards. On desktop, lists sort by tapping table
// column headers and select-all sits in the table header — the table is
// hidden on phones, so this gives the same two controls to the card view.

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MobileSortOption {
  value: string;
  label: string;
}

export function MobileListBar({
  sortOptions,
  sortBy,
  sortDir,
  onSortChange,
  selectAll,
}: {
  sortOptions: MobileSortOption[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSortChange: (sortBy: string, sortDir: "asc" | "desc") => void;
  selectAll?: { checked: boolean; onToggle: () => void; disabled?: boolean };
}) {
  const current = sortOptions.find((option) => option.value === sortBy);
  return (
    <div className="flex items-center gap-2">
      {selectAll && (
        <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={selectAll.checked}
            onCheckedChange={selectAll.onToggle}
            disabled={selectAll.disabled}
            aria-label="Select all on this page"
          />
          All
        </label>
      )}
      {sortOptions.length > 0 && (
        <>
          <Select
            value={current ? sortBy : ""}
            onValueChange={(value) => value && onSortChange(value, sortDir)}
          >
            <SelectTrigger className="min-w-0 flex-1" size="sm">
              <SelectValue placeholder="Sort by">
                {() => (current ? `Sort: ${current.label}` : "Sort by")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")}
            aria-label={sortDir === "asc" ? "Sorted ascending" : "Sorted descending"}
          >
            {sortDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            {sortDir === "asc" ? "Asc" : "Desc"}
          </Button>
        </>
      )}
    </div>
  );
}
