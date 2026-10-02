"use client";

// Shared list chrome used by Sales and Customisation so they look and work
// like the Bookings list: status tabs with counts, one search box,
// Active/Trash, date range, Table/Card switch, record count, Export
// (Excel / PDF / Print) and summary tiles. Bookings keeps its own copy
// because it also has a calendar view.

import {
  ChevronDown,
  Download,
  FileDown,
  Grid3x3,
  List,
  Printer,
  Search,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface StatusTab {
  value: string;
  label: string;
  count?: number;
}

export function StatusTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: StatusTab[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next ?? "all")}>
      {/* Swipeable on narrow screens instead of clipping tabs off-screen. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <TabsList className="w-max">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                    value === tab.value
                      ? "bg-accent/15 text-accent"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}

export function SummaryTiles({
  tiles,
}: {
  tiles: { label: string; value: string; accent?: boolean }[];
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", tiles.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{tile.label}</p>
          <p className={cn("mt-1 font-heading text-lg", tile.accent && "text-accent")}>{tile.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  trashView,
  onTrashViewChange,
  from,
  to,
  onFromChange,
  onToChange,
  onClearDates,
  layout,
  onLayoutChange,
  countLabel,
  isExporting,
  onExportExcel,
  onExportPdf,
  onPrint,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  trashView: "active" | "trash";
  onTrashViewChange: (value: "active" | "trash") => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClearDates: () => void;
  layout: "table" | "card";
  onLayoutChange: (value: "table" | "card") => void;
  countLabel: string;
  isExporting: boolean;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={trashView}
          onValueChange={(value) => onTrashViewChange((value ?? "active") as "active" | "trash")}
        >
          <SelectTrigger className="w-32">
            <SelectValue>{(value: string) => (value === "trash" ? "Trash" : "Active")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trash">Trash</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <DatePicker value={from} onChange={onFromChange} placeholder="From date" />
          <span className="text-sm text-muted-foreground">to</span>
          <DatePicker value={to} onChange={onToChange} placeholder="To date" />
          {(from || to) && (
            <Button variant="ghost" size="sm" onClick={onClearDates}>
              Clear
            </Button>
          )}
        </div>
        <div className="hidden shrink-0 rounded-md border border-border p-0.5 lg:flex">
          <button
            type="button"
            onClick={() => onLayoutChange("table")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm",
              layout === "table" ? "bg-secondary font-medium" : "text-muted-foreground"
            )}
          >
            <List className="h-4 w-4" /> Table
          </button>
          <button
            type="button"
            onClick={() => onLayoutChange("card")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm",
              layout === "card" ? "bg-secondary font-medium" : "text-muted-foreground"
            )}
          >
            <Grid3x3 className="h-4 w-4" /> Card
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">{countLabel}</p>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={isExporting} />}>
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportExcel}>
              <Table2 className="h-4 w-4" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPdf}>
              <FileDown className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPrint}>
              <Printer className="h-4 w-4" />
              Print
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
