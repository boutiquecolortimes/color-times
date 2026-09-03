"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  Grid3x3,
  List,
  Eye,
  RotateCcw,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { SaleRow, CustomerOption } from "@/components/admin/sale-form-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useCanEdit } from "@/components/admin/current-user-context";
import { formatDate } from "@/lib/utils";

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
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

async function fetchSales(params: {
  page: number;
  view: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<{ sales: SaleRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ page: String(params.page), view: params.view });
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);

  const res = await fetch(`/api/admin/sales?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return { sales: json.data.sales, pagination: json.data.pagination };
}

export function SalesClient({
  initialSales,
  initialPagination,
  products,
  customers,
}: {
  initialSales: SaleRow[];
  initialPagination: Pagination;
  products: ProductOption[];
  customers: CustomerOption[];
}) {
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"active" | "trash">("active");
  const [layout, setLayout] = useState<"table" | "card">("table");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"delete" | "permanent-delete" | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isDefaultQuery = page === 1 && view === "active" && sortBy === "createdAt" && sortDir === "desc";

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function changeView(next: "active" | "trash") {
    setView(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === sales.length ? new Set() : new Set(sales.map((s) => s._id))));
  }

  const { data } = useQuery({
    queryKey: ["admin", "sales", { page, view, sortBy, sortDir }],
    queryFn: () => fetchSales({ page, view, sortBy, sortDir }),
    initialData: isDefaultQuery
      ? { sales: initialSales, pagination: initialPagination }
      : undefined,
  });

  const sales = data?.sales ?? [];
  const pagination = data?.pagination ?? initialPagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "sales"] });
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/sales/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Sale moved to trash");
      invalidate();
      setDeleteId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/sales/${id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => toast.success("Bill sent via WhatsApp"),
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/sales/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Sale restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/sales/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Sale permanently deleted");
      invalidate();
      setPermanentDeleteId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({
      ids,
      action,
    }: {
      ids: string[];
      action: "delete" | "restore" | "permanent-delete";
    }) => {
      const res = await fetch("/api/admin/sales/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.action === "permanent-delete") {
        toast.success(
          `Permanently deleted ${variables.ids.length} sale${variables.ids.length === 1 ? "" : "s"}`
        );
      } else if (variables.action === "restore") {
        toast.success(`Restored ${variables.ids.length} sale${variables.ids.length === 1 ? "" : "s"}`);
      } else {
        toast.success(
          `Moved ${variables.ids.length} sale${variables.ids.length === 1 ? "" : "s"} to trash`
        );
      }
      invalidate();
      setSelectedIds(new Set());
      setBulkConfirmAction(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sales.map((sale) => (
        <div key={sale._id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.has(sale._id)}
                onCheckedChange={() => toggleSelectOne(sale._id)}
                aria-label={`Select ${sale.billNumber}`}
              />
              <p className="font-medium">{sale.billNumber}</p>
            </div>
            <p className="text-sm font-medium text-accent">{formatCurrency(sale.totalAmount)}</p>
          </div>
          <p className="mt-2 text-sm">{sale.customerName}</p>
          <p className="text-xs text-muted-foreground">{sale.customerPhone}</p>
          <p className="mt-2 text-sm text-muted-foreground">{sale.product?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{sale.product?.sku}</p>
          <p className="mt-2 text-xs text-muted-foreground">Sale date {formatDate(sale.saleDate)}</p>
          <div className="mt-3 flex justify-end gap-1">
            {view === "trash" ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate(sale._id)}
                  title="Restore"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    disabled={permanentDeleteMutation.isPending}
                    onClick={() => setPermanentDeleteId(sale._id)}
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <ButtonLink
                  variant="ghost"
                  size="icon"
                  href={`/admin/sales/${sale._id}`}
                  title="View details"
                >
                  <Eye className="h-4 w-4" />
                </ButtonLink>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => sendMutation.mutate(sale._id)}
                  title="Send via WhatsApp"
                >
                  <Send className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <ButtonLink
                    variant="ghost"
                    size="icon"
                    href={`/admin/sales/${sale._id}/edit`}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </ButtonLink>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setDeleteId(sale._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      {sales.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">
          {view === "trash" ? "Trash is empty." : "No sales found."}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Sale</h1>
          <p className="mt-1 text-sm text-muted-foreground">Outright dress purchases.</p>
        </div>
        <ButtonLink href="/admin/sales/new">
          <Plus className="h-4 w-4" /> New Sale
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={view}
          onValueChange={(value) => changeView((value as "active" | "trash") ?? "active")}
        >
          <SelectTrigger className="w-36">
            <SelectValue>{(value: string) => (value === "active" ? "Active" : "Trash")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trash">Trash</SelectItem>
          </SelectContent>
        </Select>
        <div className="hidden items-center gap-1 rounded-md border border-border p-1 lg:flex">
          <Button
            variant={layout === "table" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setLayout("table")}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={layout === "card" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setLayout("card")}
            aria-label="Card view"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {view === "trash" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkActionMutation.isPending}
                  onClick={() =>
                    bulkActionMutation.mutate({ ids: Array.from(selectedIds), action: "restore" })
                  }
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={bulkActionMutation.isPending}
                    onClick={() => setBulkConfirmAction("permanent-delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Permanently
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                disabled={bulkActionMutation.isPending}
                onClick={() => setBulkConfirmAction("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Move to Trash
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="lg:hidden">{cardGrid}</div>

      {layout === "card" ? (
        <div className="hidden lg:block">{cardGrid}</div>
      ) : (
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[820px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                <Checkbox
                  checked={sales.length > 0 && selectedIds.size === sales.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("billNumber")}>
                  Bill # <SortIcon field="billNumber" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("customerName")}>
                  Customer <SortIcon field="customerName" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("totalAmount")}>
                  Total <SortIcon field="totalAmount" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("saleDate")}>
                  Sale Date <SortIcon field="saleDate" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(sale._id)}
                    onCheckedChange={() => toggleSelectOne(sale._id)}
                    aria-label={`Select ${sale.billNumber}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium">{sale.billNumber}</td>
                <td className="px-4 py-3">
                  <p>{sale.customerName}</p>
                  <p className="text-xs text-muted-foreground">{sale.customerPhone}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sale.product?.name ?? "—"}
                  {sale.product?.sku && ` (${sale.product.sku})`}
                </td>
                <td className="px-4 py-3 font-medium">{formatCurrency(sale.totalAmount)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(sale.saleDate)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {view === "trash" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(sale._id)}
                          title="Restore"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            disabled={permanentDeleteMutation.isPending}
                            onClick={() => setPermanentDeleteId(sale._id)}
                            title="Delete permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <ButtonLink
                          variant="ghost"
                          size="icon"
                          href={`/admin/sales/${sale._id}`}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </ButtonLink>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => sendMutation.mutate(sale._id)}
                          title="Send via WhatsApp"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <ButtonLink
                            variant="ghost"
                            size="icon"
                            href={`/admin/sales/${sale._id}/edit`}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </ButtonLink>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteId(sale._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {view === "trash" ? "Trash is empty." : "No sales found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      <AdminPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        itemLabel="sales"
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete sale?"
        description="This will move the sale to trash."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <ConfirmDialog
        open={permanentDeleteId !== null}
        onOpenChange={(open) => !open && setPermanentDeleteId(null)}
        title="Permanently delete sale?"
        description="This cannot be undone."
        confirmLabel="Delete Permanently"
        variant="destructive"
        isLoading={permanentDeleteMutation.isPending}
        onConfirm={() => permanentDeleteId && permanentDeleteMutation.mutate(permanentDeleteId)}
      />

      <ConfirmDialog
        open={bulkConfirmAction !== null}
        onOpenChange={(open) => !open && setBulkConfirmAction(null)}
        title={
          bulkConfirmAction === "permanent-delete"
            ? `Permanently delete ${selectedIds.size} sale${selectedIds.size === 1 ? "" : "s"}?`
            : `Move ${selectedIds.size} sale${selectedIds.size === 1 ? "" : "s"} to trash?`
        }
        description={
          bulkConfirmAction === "permanent-delete"
            ? "This cannot be undone."
            : "You can restore these from the Trash view at any time."
        }
        confirmLabel={bulkConfirmAction === "permanent-delete" ? "Delete Permanently" : "Move to Trash"}
        variant="destructive"
        isLoading={bulkActionMutation.isPending}
        onConfirm={() => {
          if (bulkConfirmAction) {
            bulkActionMutation.mutate({ ids: Array.from(selectedIds), action: bulkConfirmAction });
          }
        }}
      />
    </div>
  );
}
