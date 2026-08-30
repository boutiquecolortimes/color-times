"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarCheck,
  FileText,
  FolderTree,
  IdCard,
  PackagePlus,
  Receipt,
  RotateCcw,
  Search,
  Shirt,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { cn } from "@/lib/utils";

type EntityKey =
  | "products"
  | "categories"
  | "bookings"
  | "customers"
  | "invoices"
  | "staff"
  | "salaryPayments"
  | "purchases"
  | "expenses";

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface TrashRow {
  id: string;
  primary: string;
  secondary?: string;
  deletedAt?: string | null;
}

interface EntityConfig {
  key: EntityKey;
  label: string;
  itemLabel: string;
  icon: typeof Shirt;
  listPath: string;
  listParam: "status" | "view";
  dataKey: string;
  bulkPath: string;
  permanentPath: (id: string) => string;
  restorePath: (id: string) => string;
  mapRow: (raw: Record<string, unknown>) => TrashRow;
  // Backend field the "Name" column sorts by. Undefined when the display
  // name comes from a populated/joined document (e.g. salary payments show
  // the linked staff member's name), which the list API can't sort on.
  primarySortField?: string;
}

function SortIcon({
  field,
  sortBy,
  sortDir,
}: {
  field: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}) {
  if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function customerName(raw: Record<string, unknown>): string | undefined {
  const customer = raw.customer as Record<string, unknown> | null | undefined;
  return customer ? asString(customer.name) : undefined;
}

function staffName(raw: Record<string, unknown>): string | undefined {
  const staff = raw.staff as Record<string, unknown> | null | undefined;
  return staff ? asString(staff.name) : undefined;
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: "Rent",
  electricity: "Electricity",
  water: "Water",
  maintenance: "Maintenance",
  transport: "Transport",
  marketing: "Marketing",
  office_supplies: "Office Supplies",
  miscellaneous: "Miscellaneous",
};

const ENTITIES: EntityConfig[] = [
  {
    key: "products",
    label: "Products",
    itemLabel: "products",
    icon: Shirt,
    listPath: "/api/admin/products",
    listParam: "status",
    dataKey: "products",
    bulkPath: "/api/admin/products/bulk",
    permanentPath: (id) => `/api/admin/products/${id}/permanent`,
    restorePath: (id) => `/api/admin/products/${id}/restore`,
    primarySortField: "name",
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: asString(raw.name) ?? "Untitled product",
      secondary: asString(raw.sku),
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
  {
    key: "categories",
    label: "Categories",
    itemLabel: "categories",
    icon: FolderTree,
    listPath: "/api/admin/categories",
    listParam: "status",
    dataKey: "categories",
    bulkPath: "/api/admin/categories/bulk",
    permanentPath: (id) => `/api/admin/categories/${id}/permanent`,
    restorePath: (id) => `/api/admin/categories/${id}/restore`,
    primarySortField: "name",
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: asString(raw.name) ?? "Untitled category",
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
  {
    key: "bookings",
    label: "Bookings",
    itemLabel: "bookings",
    icon: CalendarCheck,
    listPath: "/api/admin/bookings",
    listParam: "view",
    dataKey: "bookings",
    bulkPath: "/api/admin/bookings/bulk",
    permanentPath: (id) => `/api/admin/bookings/${id}/permanent`,
    restorePath: (id) => `/api/admin/bookings/${id}/restore`,
    primarySortField: "bookingNumber",
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: asString(raw.bookingNumber) ?? "Untitled booking",
      secondary: customerName(raw),
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
  {
    key: "customers",
    label: "Customers",
    itemLabel: "customers",
    icon: Users,
    listPath: "/api/admin/customers",
    listParam: "view",
    dataKey: "customers",
    bulkPath: "/api/admin/customers/bulk",
    permanentPath: (id) => `/api/admin/customers/${id}/permanent`,
    restorePath: (id) => `/api/admin/customers/${id}/restore`,
    primarySortField: "name",
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: asString(raw.name) ?? "Untitled customer",
      secondary: asString(raw.email),
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
  {
    key: "invoices",
    label: "Invoices",
    itemLabel: "invoices",
    icon: FileText,
    listPath: "/api/admin/invoices",
    listParam: "view",
    dataKey: "invoices",
    bulkPath: "/api/admin/invoices/bulk",
    permanentPath: (id) => `/api/admin/invoices/${id}/permanent`,
    restorePath: (id) => `/api/admin/invoices/${id}/restore`,
    primarySortField: "invoiceNumber",
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: asString(raw.invoiceNumber) ?? "Untitled invoice",
      secondary: customerName(raw),
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
  {
    key: "staff",
    label: "Staff",
    itemLabel: "staff",
    icon: IdCard,
    listPath: "/api/admin/staff",
    listParam: "status",
    dataKey: "staff",
    bulkPath: "/api/admin/staff/bulk",
    permanentPath: (id) => `/api/admin/staff/${id}/permanent`,
    restorePath: (id) => `/api/admin/staff/${id}/restore`,
    primarySortField: "name",
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: asString(raw.name) ?? "Untitled staff member",
      secondary: asString(raw.designation),
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
  {
    key: "salaryPayments",
    label: "Salary Payments",
    itemLabel: "salary payments",
    icon: Wallet,
    listPath: "/api/admin/salary-payments",
    listParam: "status",
    dataKey: "payments",
    bulkPath: "/api/admin/salary-payments/bulk",
    permanentPath: (id) => `/api/admin/salary-payments/${id}/permanent`,
    restorePath: (id) => `/api/admin/salary-payments/${id}/restore`,
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: staffName(raw) ?? "Untitled staff member",
      secondary: `₹${Number(raw.amount ?? 0).toLocaleString("en-IN")} for ${asString(raw.forMonth) ?? "—"}`,
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
  {
    key: "purchases",
    label: "Purchases",
    itemLabel: "purchases",
    icon: PackagePlus,
    listPath: "/api/admin/purchases",
    listParam: "status",
    dataKey: "purchases",
    bulkPath: "/api/admin/purchases/bulk",
    permanentPath: (id) => `/api/admin/purchases/${id}/permanent`,
    restorePath: (id) => `/api/admin/purchases/${id}/restore`,
    primarySortField: "itemName",
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: asString(raw.itemName) ?? "Untitled purchase",
      secondary: asString(raw.vendorName),
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
  {
    key: "expenses",
    label: "Expenses",
    itemLabel: "expenses",
    icon: Receipt,
    listPath: "/api/admin/expenses",
    listParam: "status",
    dataKey: "expenses",
    bulkPath: "/api/admin/expenses/bulk",
    permanentPath: (id) => `/api/admin/expenses/${id}/permanent`,
    restorePath: (id) => `/api/admin/expenses/${id}/restore`,
    primarySortField: "description",
    mapRow: (raw) => ({
      id: String(raw._id),
      primary: asString(raw.description) ?? "Untitled expense",
      secondary: EXPENSE_CATEGORY_LABELS[asString(raw.category) ?? ""] ?? asString(raw.category),
      deletedAt: asString(raw.deletedAt) ?? null,
    }),
  },
];

async function fetchTrash(
  entity: EntityConfig,
  params: { page: number; search: string; sortBy?: string; sortDir?: "asc" | "desc" }
): Promise<{ rows: TrashRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: "10",
    [entity.listParam]: "trash",
  });
  if (params.search) searchParams.set("search", params.search);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);

  const res = await fetch(`${entity.listPath}?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);

  const rawRows = (json.data[entity.dataKey] ?? []) as Record<string, unknown>[];
  return { rows: rawRows.map(entity.mapRow), pagination: json.data.pagination as Pagination };
}

async function fetchAllTrashIds(entity: EntityConfig): Promise<string[]> {
  const searchParams = new URLSearchParams({ [entity.listParam]: "trash", all: "true" });
  const res = await fetch(`${entity.listPath}?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  const rawRows = (json.data[entity.dataKey] ?? []) as Record<string, unknown>[];
  return rawRows.map((row) => String(row._id));
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function TrashCounts({
  counts,
}: {
  counts: Record<EntityKey, number> | undefined;
}) {
  return (
    <TabsList className="flex-wrap">
      {ENTITIES.map((entity) => (
        <TabsTrigger key={entity.key} value={entity.key} className="gap-1.5">
          <entity.icon className="h-3.5 w-3.5" />
          {entity.label}
          {counts && counts[entity.key] > 0 && (
            <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-[10px]">
              {counts[entity.key]}
            </Badge>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

function EntityTrashPanel({ entity }: { entity: EntityConfig }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<"restore" | "permanent-delete" | null>(null);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [sortBy, setSortBy] = useState("deletedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "trash", entity.key, { page, search, sortBy, sortDir }],
    queryFn: () => fetchTrash(entity, { page, search, sortBy, sortDir }),
  });

  const rows = data?.rows ?? [];
  const pagination = data?.pagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "trash", entity.key] });
    queryClient.invalidateQueries({ queryKey: ["admin", "trash", "counts"] });
    queryClient.invalidateQueries({ queryKey: ["admin", entity.key] });
    setSelectedIds(new Set());
  }

  const restoreOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(entity.restorePath(id), { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success(`${entity.label.slice(0, -1)} restored`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(entity.permanentPath(id), { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success(`${entity.label.slice(0, -1)} permanently deleted`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "restore" | "permanent-delete" }) => {
      const res = await fetch(entity.bulkPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (result: { deleted?: number; affected?: number }, variables) => {
      if (variables.action === "permanent-delete") {
        toast.success(`Permanently deleted ${result.deleted ?? variables.ids.length} ${entity.itemLabel}`);
      } else {
        toast.success(`Restored ${result.affected ?? variables.ids.length} ${entity.itemLabel}`);
      }
      invalidate();
      setConfirmAction(null);
      setEmptyTrashConfirm(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirmAction(null);
      setEmptyTrashConfirm(false);
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: async () => {
      const ids = await fetchAllTrashIds(entity);
      if (ids.length === 0) return { deleted: 0 };
      const res = await fetch(entity.bulkPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "permanent-delete" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { deleted: number };
    },
    onSuccess: (result) => {
      if (result.deleted > 0) {
        toast.success(`Emptied trash — deleted ${result.deleted} ${entity.itemLabel}`);
      } else {
        toast.info("Trash is already empty");
      }
      invalidate();
      setEmptyTrashConfirm(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setEmptyTrashConfirm(false);
    },
  });

  function toggleSelectAll() {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((row) => row.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search trashed ${entity.itemLabel}...`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={rows.length === 0}
          onClick={() => setEmptyTrashConfirm(true)}
        >
          <Trash2 className="h-4 w-4" />
          Empty Trash
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-2.5">
          <p className="text-sm font-medium">{selectedIds.size} selected</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmAction("restore")}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmAction("permanent-delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Permanently
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={rows.length > 0 && selectedIds.size === rows.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">
                {entity.primarySortField ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort(entity.primarySortField as string)}
                  >
                    Name <SortIcon field={entity.primarySortField} sortBy={sortBy} sortDir={sortDir} />
                  </button>
                ) : (
                  "Name"
                )}
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("deletedAt")}>
                  Trashed on <SortIcon field="deletedAt" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {((pagination?.page ?? 1) - 1) * (pagination?.pageSize ?? rows.length) + index + 1}
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={() => toggleSelectOne(row.id)}
                    aria-label={`Select ${row.primary}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.primary}</p>
                  {row.secondary && <p className="text-xs text-muted-foreground">{row.secondary}</p>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(row.deletedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Restore"
                            onClick={() => restoreOneMutation.mutate(row.id)}
                          />
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Restore</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive"
                            aria-label="Delete permanently"
                            onClick={() => permanentOneMutation.mutate(row.id)}
                          />
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Delete permanently</TooltipContent>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {isFetching ? "Loading..." : `Trash is empty — no ${entity.itemLabel} to show.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          itemLabel={entity.itemLabel}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction === "permanent-delete" ? `Permanently delete ${selectedIds.size} item(s)?` : `Restore ${selectedIds.size} item(s)?`}
        description={
          confirmAction === "permanent-delete"
            ? "This cannot be undone, even if bookings, invoices, or other records still reference these items."
            : `These ${entity.itemLabel} will move back to their active list.`
        }
        confirmLabel={confirmAction === "permanent-delete" ? "Delete Permanently" : "Restore"}
        variant={confirmAction === "permanent-delete" ? "destructive" : "default"}
        isLoading={bulkMutation.isPending}
        onConfirm={() => {
          if (!confirmAction) return;
          bulkMutation.mutate({ ids: Array.from(selectedIds), action: confirmAction });
        }}
      />

      <ConfirmDialog
        open={emptyTrashConfirm}
        onOpenChange={setEmptyTrashConfirm}
        title={`Empty ${entity.label} trash?`}
        description={`Every trashed ${entity.itemLabel.slice(0, -1)} will be permanently deleted, even if bookings, invoices, or other records still reference it. This cannot be undone.`}
        confirmLabel="Empty Trash"
        variant="destructive"
        isLoading={emptyTrashMutation.isPending}
        onConfirm={() => emptyTrashMutation.mutate()}
      />
    </div>
  );
}

export function TrashClient() {
  const [activeTab, setActiveTab] = useState<EntityKey>("products");

  const { data: counts } = useQuery({
    queryKey: ["admin", "trash", "counts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/trash/counts");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.counts as Record<EntityKey, number>;
    },
  });

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => value && setActiveTab(value as EntityKey)}
      className={cn("gap-4")}
    >
      <TrashCounts counts={counts} />
      {ENTITIES.map((entity) => (
        <TabsContent key={entity.key} value={entity.key}>
          <EntityTrashPanel entity={entity} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
