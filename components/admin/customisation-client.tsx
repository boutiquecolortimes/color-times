"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Pencil,
  Plus,
  Send,
  IndianRupee,
  Trash2,
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
import { CustomisationStatusBadge } from "@/components/admin/customisation-status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useCanEdit } from "@/components/admin/current-user-context";
import type { CustomisationOrderRow, CustomerOption } from "@/components/admin/customisation-form-dialog";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";
import { ListToolbar, StatusTabs, SummaryTiles } from "@/components/admin/list-toolbar";
import { CollectPaymentDialog, type CollectPaymentTarget } from "@/components/admin/collect-payment-dialog";
import type { MoneySummary } from "@/lib/admin/list-summaries";
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

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

interface OrdersResult {
  orders: CustomisationOrderRow[];
  pagination: Pagination;
  summary: MoneySummary;
  statusCounts: Record<string, number>;
}

async function fetchOrders(params: {
  page: number;
  status: string;
  view: string;
  search: string;
  from: string;
  to: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  all?: boolean;
}): Promise<OrdersResult> {
  const searchParams = new URLSearchParams({ page: String(params.page), view: params.view });
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
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
  initialSummary,
  initialStatusCounts,
  customers,
}: {
  initialOrders: CustomisationOrderRow[];
  initialPagination: Pagination;
  initialSummary: MoneySummary;
  initialStatusCounts: Record<string, number>;
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [collectTarget, setCollectTarget] = useState<CollectPaymentTarget | null>(null);
  const [collectMarksDelivered, setCollectMarksDelivered] = useState(false);

  function openCollect(order: CustomisationOrderRow, markDelivered: boolean) {
    setCollectMarksDelivered(markDelivered);
    setCollectTarget({
      kind: "customisation",
      id: order._id,
      billNumber: order.billNumber,
      customerName: order.customerName,
      totalAmount: order.totalAmount,
      advancePayment: order.advancePayment,
      dueAmount: order.dueAmount,
    });
  }

  // Moving to Delivered with money still due opens the Collect payment
  // popup instead (it marks the order delivered once payment is recorded).
  function changeStatus(order: CustomisationOrderRow, value: string) {
    if (value === "delivered" && order.dueAmount > 0) {
      openCollect(order, true);
      return;
    }
    statusMutation.mutate({ id: order._id, status: value as CustomisationOrderStatus });
  }
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isDefaultQuery =
    page === 1 &&
    status === "all" &&
    view === "active" &&
    search === "" &&
    from === "" &&
    to === "" &&
    sortBy === "createdAt" &&
    sortDir === "desc";

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
    queryKey: ["admin", "customisation-orders", { page, status, view, search, from, to, sortBy, sortDir }],
    queryFn: () => fetchOrders({ page, status, view, search, from, to, sortBy, sortDir }),
    initialData: isDefaultQuery
      ? {
          orders: initialOrders,
          pagination: initialPagination,
          summary: initialSummary,
          statusCounts: initialStatusCounts,
        }
      : undefined,
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination ?? initialPagination;
  const summary = data?.summary ?? initialSummary;
  const statusCounts = data?.statusCounts ?? initialStatusCounts;

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
      STATUS_LABELS[order.status] ?? order.status,
    ]);
  }

  function totalsRow(rows: (string | number)[][]): (string | number)[] {
    const sum = (col: number) => rows.reduce((acc, row) => acc + (Number(row[col]) || 0), 0);
    return ["", "TOTAL", "", "", sum(4), sum(5), sum(6), "", ""];
  }

  async function fetchAllOrdersForExport(): Promise<CustomisationOrderRow[]> {
    const result = await fetchOrders({
      page: 1,
      status,
      view,
      search,
      from,
      to,
      sortBy,
      sortDir,
      all: true,
    });
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
      await downloadExcel("customisation-orders", "Customisation Orders", exportHeaders, rows, totalsRow(rows));
    });
  }

  function handleExportPdf() {
    void withExportGuard(async () => {
      const rows = ordersToRows(await fetchAllOrdersForExport());
      await downloadPdf("customisation-orders", "Customisation Orders", exportHeaders, rows, totalsRow(rows));
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
                  if (value && value !== order.status) changeStatus(order, value);
                }}
              >
                <SelectTrigger className="mt-3 w-full" size="sm">
                  <SelectValue>{(value: string) => STATUS_LABELS[value] ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {STATUS_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-3 flex justify-end gap-1">
                {order.dueAmount > 0 && order.status !== "cancelled" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openCollect(order, false)}
                    title="Collect payment"
                  >
                    <IndianRupee className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => sendMutation.mutate(order._id)}
                  title="Send via WhatsApp"
                >
                  <Send className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <ButtonLink
                    variant="ghost"
                    size="icon"
                    href={`/admin/customisation/${order._id}/edit`}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </ButtonLink>
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
        <ButtonLink href="/admin/customisation/new">
          <Plus className="h-4 w-4" /> New Customisation Order
        </ButtonLink>
      </div>

      <SummaryTiles
        tiles={[
          { label: "Total Orders Value", value: formatCurrency(summary.totalAmount) },
          { label: "Advance Collected", value: formatCurrency(summary.advancePayment) },
          { label: "Due Amount", value: formatCurrency(summary.dueAmount), accent: true },
        ]}
      />

      <StatusTabs
        value={status}
        onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        tabs={[
          { value: "all", label: "All", count: statusCounts.all ?? 0 },
          ...STATUS_OPTIONS.map((option) => ({
            value: option,
            label: STATUS_LABELS[option],
            count: statusCounts[option] ?? 0,
          })),
        ]}
      />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search bill #, customer, phone, or stitching type..."
        trashView={view}
        onTrashViewChange={(value) => {
          setView(value);
          setPage(1);
        }}
        from={from}
        to={to}
        onFromChange={(value) => {
          setFrom(value);
          setPage(1);
        }}
        onToChange={(value) => {
          setTo(value);
          setPage(1);
        }}
        onClearDates={() => {
          setFrom("");
          setTo("");
          setPage(1);
        }}
        layout={layout}
        onLayoutChange={setLayout}
        countLabel={`${pagination.total} orders`}
        isExporting={isExporting}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onPrint={handlePrint}
      />

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
                        if (value && value !== order.status) changeStatus(order, value);
                      }}
                    >
                      <SelectTrigger size="sm" className="w-40">
                        <SelectValue>
                          {(value: string) => STATUS_LABELS[value] ?? value}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {STATUS_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {view === "active" && (
                    <div className="flex justify-end gap-1">
                      {order.dueAmount > 0 && order.status !== "cancelled" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openCollect(order, false)}
                          title="Collect payment"
                        >
                          <IndianRupee className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => sendMutation.mutate(order._id)}
                        title="Send via WhatsApp"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <ButtonLink
                          variant="ghost"
                          size="icon"
                          href={`/admin/customisation/${order._id}/edit`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </ButtonLink>
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

      <CollectPaymentDialog
        target={collectTarget}
        open={collectTarget !== null}
        onOpenChange={(open) => !open && setCollectTarget(null)}
        markDelivered={collectMarksDelivered}
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
