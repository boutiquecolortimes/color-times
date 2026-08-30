"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  FileDown,
  Grid3x3,
  List,
  Pencil,
  Plus,
  Printer,
  Send,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CustomisationStatusBadge } from "@/components/admin/customisation-status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useCanEdit } from "@/components/admin/current-user-context";
import {
  CustomisationFormDialog,
  type CustomisationOrderRow,
  type CustomerOption,
} from "@/components/admin/customisation-form-dialog";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";
import { formatDate } from "@/lib/utils";
import type { CustomisationOrderStatus } from "@/models/CustomisationOrder";

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS: CustomisationOrderStatus[] = [
  "pending",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
];

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

async function fetchOrders(params: {
  page: number;
  status: string;
  view: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  all?: boolean;
}): Promise<{ orders: CustomisationOrderRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ page: String(params.page), view: params.view });
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.all) searchParams.set("all", "true");

  const res = await fetch(`/api/admin/customisation-orders?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
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

export function CustomisationClient({
  initialOrders,
  initialPagination,
  customers,
}: {
  initialOrders: CustomisationOrderRow[];
  initialPagination: Pagination;
  customers: CustomerOption[];
}) {
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"active" | "trash">("active");
  const [layout, setLayout] = useState<"table" | "card">("table");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomisationOrderRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isDefaultQuery =
    page === 1 && status === "all" && view === "active" && sortBy === "createdAt" && sortDir === "desc";

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
    queryKey: ["admin", "customisation-orders", { page, status, view, sortBy, sortDir }],
    queryFn: () => fetchOrders({ page, status, view, sortBy, sortDir }),
    initialData: isDefaultQuery
      ? { orders: initialOrders, pagination: initialPagination }
      : undefined,
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination ?? initialPagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "customisation-orders"] });
  }

  const exportHeaders = ["Sr No", "Bill #", "Customer", "Stitching Type", "Total", "Advance", "Due", "Order Date", "Status"];

  function ordersToRows(rows: CustomisationOrderRow[]): (string | number)[][] {
    return rows.map((order, index) => [
      index + 1,
      order.billNumber,
      order.customerName,
      order.stitchingType,
      order.totalAmount,
      order.advancePayment,
      order.dueAmount,
      formatDate(order.orderDate),
      order.status.replace("_", " "),
    ]);
  }

  async function fetchAllOrdersForExport(): Promise<CustomisationOrderRow[]> {
    const result = await fetchOrders({ page: 1, status, view, sortBy, sortDir, all: true });
    return result.orders;
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

  function handleExportExcel() {
    void withExportGuard(async () => {
      const rows = ordersToRows(await fetchAllOrdersForExport());
      await downloadExcel("customisation-orders", "Customisation Orders", exportHeaders, rows);
    });
  }

  function handleExportPdf() {
    void withExportGuard(async () => {
      const rows = ordersToRows(await fetchAllOrdersForExport());
      await downloadPdf("customisation-orders", "Customisation Orders", exportHeaders, rows);
    });
  }

  function handlePrint() {
    window.print();
  }

  const statusMutation = useMutation({
    mutationFn: async ({ id, status: newStatus }: { id: string; status: CustomisationOrderStatus }) => {
      const res = await fetch(`/api/admin/customisation-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.order;
    },
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/customisation-orders/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Order deleted");
      invalidate();
      setDeleteId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/customisation-orders/${id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => toast.success("Bill sent via WhatsApp"),
    onError: (error: Error) => toast.error(error.message),
  });

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <div key={order._id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{order.billNumber}</p>
            <CustomisationStatusBadge status={order.status as CustomisationOrderStatus} />
          </div>
          <p className="mt-2 text-sm">{order.customerName}</p>
          <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
          <p className="mt-1 text-sm text-muted-foreground">{order.stitchingType}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p>{formatCurrency(order.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Advance</p>
              <p>{formatCurrency(order.advancePayment)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due</p>
              <p className="font-medium">{formatCurrency(order.dueAmount)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Order date {formatDate(order.orderDate)}
          </p>
          {view === "active" && (
            <>
              <Select
                value={order.status}
                onValueChange={(value) => {
                  if (value && value !== order.status) {
                    statusMutation.mutate({ id: order._id, status: value as CustomisationOrderStatus });
                  }
                }}
              >
                <SelectTrigger className="mt-3 w-full" size="sm">
                  <SelectValue>{(value: string) => value.replace("_", " ")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-3 flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => sendMutation.mutate(order._id)}
                  title="Send via WhatsApp"
                >
                  <Send className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingOrder(order);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setDeleteId(order._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      ))}
      {orders.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">No customisation orders found.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/*
        "New Customisation Order" is a long label, and this header row had
        no responsive stacking (unlike the equivalent header on
        customers/products/staff/etc., which all use flex-col below sm) —
        on a narrow screen it sat beside the title with nothing to wrap or
        stack it. Matching that established pattern here too.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl">Customisation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Custom stitching and design orders.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingOrder(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New Customisation Order
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue>
              {(value: string) => (value === "all" ? "All Statuses" : value.replace("_", " "))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={view}
          onValueChange={(value) => {
            setView((value as "active" | "trash") ?? "active");
            setPage(1);
          }}
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
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={isExporting} />}>
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportExcel}>
              <Table2 className="h-4 w-4" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdf}>
              <FileDown className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="lg:hidden">{cardGrid}</div>

      {layout === "card" ? (
        <div className="hidden lg:block">{cardGrid}</div>
      ) : (
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[860px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
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
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("stitchingType")}>
                  Stitching Type <SortIcon field="stitchingType" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("totalAmount")}>
                  Total <SortIcon field="totalAmount" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("advancePayment")}>
                  Advance <SortIcon field="advancePayment" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("dueAmount")}>
                  Due <SortIcon field="dueAmount" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("orderDate")}>
                  Order Date <SortIcon field="orderDate" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("status")}>
                  Status <SortIcon field="status" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => (
              <tr key={order._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {(pagination.page - 1) * pagination.pageSize + index + 1}
                </td>
                <td className="px-4 py-3 font-medium">{order.billNumber}</td>
                <td className="px-4 py-3">
                  <p>{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{order.stitchingType}</td>
                <td className="px-4 py-3">{formatCurrency(order.totalAmount)}</td>
                <td className="px-4 py-3">{formatCurrency(order.advancePayment)}</td>
                <td className="px-4 py-3 font-medium">{formatCurrency(order.dueAmount)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(order.orderDate)}
                </td>
                <td className="px-4 py-3">
                  {view === "trash" ? (
                    <CustomisationStatusBadge status={order.status as CustomisationOrderStatus} />
                  ) : (
                    <Select
                      value={order.status}
                      onValueChange={(value) => {
                        if (value && value !== order.status) {
                          statusMutation.mutate({
                            id: order._id,
                            status: value as CustomisationOrderStatus,
                          });
                        }
                      }}
                    >
                      <SelectTrigger size="sm" className="w-40">
                        <SelectValue>
                          {(value: string) => value.replace("_", " ")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {view === "active" && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => sendMutation.mutate(order._id)}
                        title="Send via WhatsApp"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingOrder(order);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteId(order._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  No customisation orders found.
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
        itemLabel="orders"
        onPageChange={setPage}
      />

      <CustomisationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customers={customers}
        editingOrder={editingOrder}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete customisation order?"
        description="This will move the order to trash."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
