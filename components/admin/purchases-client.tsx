"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useCanEdit } from "@/components/admin/current-user-context";
import { purchaseSchema, type PurchaseInput } from "@/lib/validations/purchase";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";

interface PurchaseRow {
  _id: string;
  billNumber?: string;
  itemName: string;
  vendorName: string;
  vendorContact?: string;
  product: { _id: string; name: string; sku: string } | null;
  variantSize?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  paymentStatus: "paid" | "pending" | "partial";
  amountPaid: number;
  addedToStock: boolean;
  notes?: string;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  variants: { size: string; quantityInStock: number }[];
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  pending: "Pending",
  partial: "Partially Paid",
};

const NO_PRODUCT_VALUE = "__none__";

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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

async function fetchPurchases(params: {
  status: string;
  page: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  all?: boolean;
}): Promise<{ purchases: PurchaseRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ status: params.status, page: String(params.page) });
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.all) searchParams.set("all", "true");
  const res = await fetch(`/api/admin/purchases?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function fetchProductOptions(): Promise<ProductOption[]> {
  const res = await fetch("/api/admin/products?status=active&all=true");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.products;
}

export function PurchasesClient({
  initialPurchases,
  initialPagination,
}: {
  initialPurchases: PurchaseRow[];
  initialPagination: Pagination;
}) {
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRow | null>(null);
  const [status, setStatus] = useState<"active" | "trash">("active");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("purchaseDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRow | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<PurchaseRow | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"delete" | "permanent-delete" | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isDefaultQuery = status === "active" && page === 1 && sortBy === "purchaseDate" && sortDir === "desc";

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  const { data } = useQuery({
    queryKey: ["admin", "purchases", { status, page, sortBy, sortDir }],
    queryFn: () => fetchPurchases({ status, page, sortBy, sortDir }),
    initialData: isDefaultQuery ? { purchases: initialPurchases, pagination: initialPagination } : undefined,
  });

  const { data: productOptions = [] } = useQuery({
    queryKey: ["admin", "products", "active-options"],
    queryFn: fetchProductOptions,
    enabled: dialogOpen,
  });

  const purchases = data?.purchases ?? [];
  const pagination = data?.pagination ?? initialPagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "purchases"] });
  }

  const form = useForm<PurchaseInput>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      itemName: "",
      vendorName: "",
      vendorContact: "",
      product: "",
      variantSize: "",
      quantity: 1,
      unitCost: 0,
      purchaseDate: new Date().toISOString().slice(0, 10),
      paymentStatus: "paid",
      amountPaid: 0,
      addToStock: false,
      notes: "",
    },
  });

  const watchedProduct = form.watch("product");
  const watchedQuantity = form.watch("quantity") || 0;
  const watchedUnitCost = form.watch("unitCost") || 0;
  const selectedProduct = productOptions.find((p) => p._id === watchedProduct);

  function openCreateDialog() {
    setEditing(null);
    form.reset({
      itemName: "",
      vendorName: "",
      vendorContact: "",
      product: "",
      variantSize: "",
      quantity: 1,
      unitCost: 0,
      purchaseDate: new Date().toISOString().slice(0, 10),
      paymentStatus: "paid",
      amountPaid: 0,
      addToStock: false,
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(purchase: PurchaseRow) {
    setEditing(purchase);
    form.reset({
      itemName: purchase.itemName,
      vendorName: purchase.vendorName,
      vendorContact: purchase.vendorContact ?? "",
      product: purchase.product?._id ?? "",
      variantSize: purchase.variantSize ?? "",
      quantity: purchase.quantity,
      unitCost: purchase.unitCost,
      purchaseDate: purchase.purchaseDate.slice(0, 10),
      paymentStatus: purchase.paymentStatus,
      amountPaid: purchase.amountPaid,
      addToStock: purchase.addedToStock,
      notes: purchase.notes ?? "",
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: PurchaseInput) => {
      const url = editing ? `/api/admin/purchases/${editing._id}` : "/api/admin/purchases";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.purchase;
    },
    onSuccess: () => {
      toast.success(editing ? "Purchase updated" : "Purchase recorded");
      invalidate();
      if (!editing) queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/purchases/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Purchase moved to trash");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/purchases/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Purchase restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/purchases/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Purchase permanently deleted");
      invalidate();
      setPermanentDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "delete" | "restore" | "permanent-delete" }) => {
      const res = await fetch("/api/admin/purchases/bulk", {
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
        toast.success(`Permanently deleted ${variables.ids.length} purchase(s)`);
      } else if (variables.action === "restore") {
        toast.success(`Restored ${variables.ids.length} purchase(s)`);
      } else {
        toast.success(`Moved ${variables.ids.length} purchase(s) to trash`);
      }
      invalidate();
      setSelectedIds(new Set());
      setBulkConfirmAction(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === purchases.length ? new Set() : new Set(purchases.map((p) => p._id))));
  }

  function changeStatus(next: "active" | "trash") {
    setStatus(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  const exportHeaders = ["Sr No", "Bill #", "Item", "Vendor", "Quantity", "Unit Cost", "Total Cost", "Purchase Date", "Payment Status"];

  function purchasesToRows(rows: PurchaseRow[]): (string | number)[][] {
    return rows.map((purchase, index) => [
      index + 1,
      purchase.billNumber || "—",
      purchase.itemName,
      purchase.vendorName,
      purchase.quantity,
      purchase.unitCost,
      purchase.totalCost,
      formatDate(purchase.purchaseDate),
      PAYMENT_STATUS_LABELS[purchase.paymentStatus] ?? purchase.paymentStatus,
    ]);
  }

  async function fetchAllForExport(): Promise<PurchaseRow[]> {
    const result = await fetchPurchases({ status, page: 1, sortBy, sortDir, all: true });
    return result.purchases;
  }

  async function withExportGuard(action: () => Promise<void>): Promise<void> {
    setIsExporting(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Purchases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track money spent buying dresses, fabric, and other materials from vendors — optionally
          adding straight to a dress&rsquo;s stock.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{pagination.total} purchases</p>
          <Select value={status} onValueChange={(value) => changeStatus((value ?? "active") as "active" | "trash")}>
            <SelectTrigger className="w-32">
              <SelectValue>{(value: string) => (value === "trash" ? "Trash" : "Active")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trash">Trash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={isExporting} />}>
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  withExportGuard(async () => {
                    const rows = purchasesToRows(await fetchAllForExport());
                    await downloadExcel("purchases", "Purchases", exportHeaders, rows);
                  })
                }
              >
                <Table2 className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  withExportGuard(async () => {
                    const rows = purchasesToRows(await fetchAllForExport());
                    await downloadPdf("purchases", "Purchases", exportHeaders, rows);
                  })
                }
              >
                <FileDown className="h-4 w-4" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {status === "active" && (
            <ButtonLink href="/admin/purchases/new" className="rounded-md">
              <Plus className="h-4 w-4" />
              New Purchase
            </ButtonLink>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {status === "trash" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkActionMutation.isPending}
                  onClick={() => bulkActionMutation.mutate({ ids: Array.from(selectedIds), action: "restore" })}
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

      <div className="lg:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {purchases.map((purchase) => (
            <div key={purchase._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedIds.has(purchase._id)}
                    onCheckedChange={() => toggleSelectOne(purchase._id)}
                    aria-label={`Select ${purchase.itemName}`}
                  />
                  <div>
                    <p className="font-medium">{purchase.itemName}</p>
                    <p className="text-xs text-muted-foreground">Bill #{purchase.billNumber || "—"}</p>
                  </div>
                </div>
                <Badge variant={purchase.paymentStatus === "paid" ? "secondary" : "outline"}>
                  {PAYMENT_STATUS_LABELS[purchase.paymentStatus]}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{purchase.vendorName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {purchase.product ? (
                  <>
                    {purchase.product.name}
                    {purchase.addedToStock && (
                      <Badge variant="secondary" className="ml-1.5">
                        +stock
                      </Badge>
                    )}
                  </>
                ) : (
                  "Not linked to inventory"
                )}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Qty</span>
                <span className="text-right text-foreground">{purchase.quantity}</span>
                <span>Total Cost</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(purchase.totalCost)}
                </span>
                <span>Date</span>
                <span className="text-right text-foreground">{formatDate(purchase.purchaseDate)}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {status === "trash" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate(purchase._id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        disabled={permanentDeleteMutation.isPending}
                        onClick={() => setPermanentDeleteTarget(purchase)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(purchase)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteTarget(purchase)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {purchases.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {status === "trash" ? "Trash is empty." : "No purchases yet. Record your first one."}
            </p>
          )}
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[880px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
              <th className="px-4 py-3">
                <Checkbox
                  checked={purchases.length > 0 && selectedIds.size === purchases.length}
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
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("itemName")}>
                  Item <SortIcon field="itemName" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("vendorName")}>
                  Vendor <SortIcon field="vendorName" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Linked Dress</th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("quantity")}>
                  Qty <SortIcon field="quantity" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("totalCost")}>
                  Total Cost <SortIcon field="totalCost" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("purchaseDate")}>
                  Date <SortIcon field="purchaseDate" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("paymentStatus")}>
                  Payment <SortIcon field="paymentStatus" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase, index) => (
              <tr key={purchase._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {(pagination.page - 1) * pagination.pageSize + index + 1}
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(purchase._id)}
                    onCheckedChange={() => toggleSelectOne(purchase._id)}
                    aria-label={`Select ${purchase.itemName}`}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{purchase.billNumber || "—"}</td>
                <td className="px-4 py-3 font-medium">{purchase.itemName}</td>
                <td className="px-4 py-3 text-muted-foreground">{purchase.vendorName}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {purchase.product ? (
                    <span>
                      {purchase.product.name}
                      {purchase.addedToStock && (
                        <Badge variant="secondary" className="ml-1.5">
                          +stock
                        </Badge>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">{purchase.quantity}</td>
                <td className="px-4 py-3">{formatCurrency(purchase.totalCost)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(purchase.purchaseDate)}</td>
                <td className="px-4 py-3">
                  <Badge variant={purchase.paymentStatus === "paid" ? "secondary" : "outline"}>
                    {PAYMENT_STATUS_LABELS[purchase.paymentStatus]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {status === "trash" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(purchase._id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive"
                            disabled={permanentDeleteMutation.isPending}
                            onClick={() => setPermanentDeleteTarget(purchase)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(purchase)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(purchase)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  {status === "trash" ? "Trash is empty." : "No purchases yet. Record your first one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        itemLabel="purchases"
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Purchase" : "New Purchase"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="itemName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Red silk fabric" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="vendorContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Contact (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!editing && (
                <FormField
                  control={form.control}
                  name="product"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link to a dress (optional)</FormLabel>
                      <Select
                        value={field.value || NO_PRODUCT_VALUE}
                        onValueChange={(value) => field.onChange(value === NO_PRODUCT_VALUE ? "" : value)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {() => productOptions.find((p) => p._id === field.value)?.name ?? "Not linked"}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_PRODUCT_VALUE}>Not linked to inventory</SelectItem>
                          {productOptions.map((product) => (
                            <SelectItem key={product._id} value={product._id}>
                              {product.name} ({product.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {!editing && watchedProduct && (
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-secondary/30 p-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="variantSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={selectedProduct?.variants[0]?.size || "e.g. M, 38, Custom"} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="addToStock"
                    render={({ field }) => (
                      <FormItem className="flex items-end pb-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox checked={field.value ?? false} onCheckedChange={(checked) => field.onChange(checked === true)} />
                          Add quantity to this dress&rsquo;s stock
                        </label>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          value={field.value === 0 ? "" : field.value}
                          onChange={(event) => field.onChange(Math.max(1, Number(event.target.value) || 1))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Cost (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value === 0 ? "" : field.value}
                          onChange={(event) => field.onChange(Math.max(0, Number(event.target.value) || 0))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Total cost:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(watchedQuantity * watchedUnitCost)}
                </span>
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select value={field.value ?? "paid"} onValueChange={(value) => field.onChange(value ?? "paid")}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>{(value: string) => PAYMENT_STATUS_LABELS[value] ?? value}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="amountPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Paid So Far (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value === 0 ? "" : field.value}
                        onChange={(event) => field.onChange(Math.max(0, Number(event.target.value) || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Save Changes" : "Record Purchase"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Move purchase to trash?"
        description={
          deleteTarget ? `Move "${deleteTarget.itemName}" to trash? You can restore it later.` : ""
        }
        confirmLabel="Move to Trash"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget._id);
        }}
      />

      <ConfirmDialog
        open={permanentDeleteTarget !== null}
        onOpenChange={(open) => !open && setPermanentDeleteTarget(null)}
        title="Permanently delete this purchase?"
        description="This cannot be undone. Stock already added to a dress from this purchase will not be reversed automatically."
        confirmLabel="Delete Permanently"
        variant="destructive"
        isLoading={permanentDeleteMutation.isPending}
        onConfirm={() => {
          if (permanentDeleteTarget) permanentDeleteMutation.mutate(permanentDeleteTarget._id);
        }}
      />

      <ConfirmDialog
        open={bulkConfirmAction !== null}
        onOpenChange={(open) => !open && setBulkConfirmAction(null)}
        title={
          bulkConfirmAction === "permanent-delete"
            ? `Permanently delete ${selectedIds.size} purchase(s)?`
            : `Move ${selectedIds.size} purchase(s) to trash?`
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
