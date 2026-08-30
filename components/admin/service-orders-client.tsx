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
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { ServiceOrderStatusBadge } from "@/components/admin/service-order-status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  ServiceOrderFormDialog,
  type ServiceOrderRow,
} from "@/components/admin/service-order-form-dialog";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";
import { formatDate } from "@/lib/utils";
import type { ServiceOrderStatus, ServiceType } from "@/models/ServiceOrder";

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

const STATUS_OPTIONS: ServiceOrderStatus[] = [
  "pending",
  "in_progress",
  "quality_check",
  "completed",
  "cancelled",
];

function formatCurrency(value?: number): string {
  return `₹${(value ?? 0).toLocaleString("en-IN")}`;
}

async function fetchServiceOrders(params: {
  page: number;
  status: string;
  serviceType: ServiceType;
  view: string;
  search?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  all?: boolean;
}): Promise<{ orders: ServiceOrderRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    view: params.view,
    serviceType: params.serviceType,
  });
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.all) searchParams.set("all", "true");

  const res = await fetch(`/api/admin/service-orders?${searchParams.toString()}`);
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

export function ServiceOrdersClient({
  initialOrders,
  initialPagination,
  products,
}: {
  initialOrders: ServiceOrderRow[];
  initialPagination: Pagination;
  products: ProductOption[];
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [serviceType, setServiceType] = useState<ServiceType>("dry_clean");
  const [view, setView] = useState<"active" | "trash">("active");
  const [layout, setLayout] = useState<"table" | "card">("table");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ServiceOrderRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isDefaultQuery =
    page === 1 &&
    status === "all" &&
    serviceType === "dry_clean" &&
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
    queryKey: ["admin", "service-orders", { page, status, serviceType, view, search, from, to, sortBy, sortDir }],
    queryFn: () => fetchServiceOrders({ page, status, serviceType, view, search, from, to, sortBy, sortDir }),
    initialData: isDefaultQuery
      ? { orders: initialOrders, pagination: initialPagination }
      : undefined,
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination ?? initialPagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "service-orders"] });
  }

  const exportHeaders = [
    "Sr No",
    "Product",
    "Description",
    "Other",
    "Total",
    "Assigned To",
    "Sent Date",
    "Expected Return",
    "Status",
  ];

  function ordersToRows(rows: ServiceOrderRow[]): (string | number)[][] {
    return rows.map((order, index) => [
      index + 1,
      order.product?.name ?? "—",
      order.description,
      formatCurrency(order.otherCharge),
      formatCurrency(order.totalAmount),
      order.assignedTo ?? "—",
      formatDate(order.sentDate),
      formatDate(order.expectedReturnDate),
      order.status.replace("_", " "),
    ]);
  }

  async function fetchAllOrdersForExport(): Promise<ServiceOrderRow[]> {
    const result = await fetchServiceOrders({
      page: 1,
      status,
      serviceType,
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
      const title = serviceType === "dry_clean" ? "Dry Clean Orders" : "Tailor Orders";
      await downloadExcel("service-orders", title, exportHeaders, rows);
    });
  }

  function handleExportPdf() {
    void withExportGuard(async () => {
      const rows = ordersToRows(await fetchAllOrdersForExport());
      const title = serviceType === "dry_clean" ? "Dry Clean Orders" : "Tailor Orders";
      await downloadPdf("service-orders", title, exportHeaders, rows);
    });
  }

  function handlePrint() {
    window.print();
  }

  const statusMutation = useMutation({
    mutationFn: async ({ id, status: newStatus }: { id: string; status: ServiceOrderStatus }) => {
      const res = await fetch(`/api/admin/service-orders/${id}`, {
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
      const res = await fetch(`/api/admin/service-orders/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Service order deleted");
      invalidate();
      setDeleteId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <div key={order._id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{order.product?.name ?? "—"}</p>
            {view === "trash" && (
              <ServiceOrderStatusBadge status={order.status as ServiceOrderStatus} />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {serviceType === "dry_clean" ? "Dry Clean" : order.stitchingType || "Tailor / Alteration"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{order.description}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {serviceType === "dry_clean" ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Dry Clean</p>
                  <p>{formatCurrency(order.dryCleanCharge)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Iron</p>
                  <p>{formatCurrency(order.ironCharge)}</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">Stitching</p>
                <p>{formatCurrency(order.stitchingCharge)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Other</p>
              <p>{formatCurrency(order.otherCharge)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-medium">{formatCurrency(order.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assigned To</p>
              <p>{order.assignedTo ?? "—"}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Expected return {formatDate(order.expectedReturnDate)}
          </p>
          {view === "active" && (
            <>
              <Select
                value={order.status}
                onValueChange={(value) => {
                  if (value && value !== order.status) {
                    statusMutation.mutate({ id: order._id, status: value as ServiceOrderStatus });
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
                  onClick={() => {
                    setEditingOrder(order);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
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
        <p className="col-span-full py-10 text-center text-muted-foreground">No service orders found.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/*
        "Dry Clean & Tailor" at text-2xl plus "New Service Order" left
        almost no slack on a 375px screen with nothing to stack them —
        matching the flex-col-below-sm pattern used on the equivalent
        header elsewhere in the admin (customers, products, staff).
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl">Dry Clean &amp; Tailor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track dresses sent for cleaning, alteration, and repair.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingOrder(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New Service Order
        </Button>
      </div>

      <Tabs
        value={serviceType}
        onValueChange={(value) => {
          setServiceType((value as ServiceType) ?? "dry_clean");
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="dry_clean">Dry Clean</TabsTrigger>
          <TabsTrigger value="tailor">Tailor / Alteration</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search dress, description, assigned to..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
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
        <div className="flex items-center gap-2">
          <DatePicker
            value={from}
            onChange={(value) => {
              setFrom(value);
              setPage(1);
            }}
            placeholder="Sent from"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <DatePicker
            value={to}
            onChange={(value) => {
              setTo(value);
              setPage(1);
            }}
            placeholder="Sent to"
          />
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>
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
        <table className="w-full min-w-[820px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("description")}>
                  Description <SortIcon field="description" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              {serviceType === "dry_clean" ? (
                <>
                  <th className="px-4 py-3">Dry Clean</th>
                  <th className="px-4 py-3">Iron</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3">Stitching Type</th>
                  <th className="px-4 py-3">Stitching</th>
                </>
              )}
              <th className="px-4 py-3">Other</th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("totalAmount")}>
                  Total <SortIcon field="totalAmount" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("assignedTo")}>
                  Assigned To <SortIcon field="assignedTo" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("expectedReturnDate")}>
                  Expected Return <SortIcon field="expectedReturnDate" sortBy={sortBy} sortDir={sortDir} />
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
                <td className="px-4 py-3 font-medium">{order.product?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{order.description}</td>
                {serviceType === "dry_clean" ? (
                  <>
                    <td className="px-4 py-3">{formatCurrency(order.dryCleanCharge)}</td>
                    <td className="px-4 py-3">{formatCurrency(order.ironCharge)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-muted-foreground">{order.stitchingType ?? "—"}</td>
                    <td className="px-4 py-3">{formatCurrency(order.stitchingCharge)}</td>
                  </>
                )}
                <td className="px-4 py-3">{formatCurrency(order.otherCharge)}</td>
                <td className="px-4 py-3 font-medium">{formatCurrency(order.totalAmount)}</td>
                <td className="px-4 py-3 text-muted-foreground">{order.assignedTo ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(order.expectedReturnDate)}
                </td>
                <td className="px-4 py-3">
                  {view === "trash" ? (
                    <ServiceOrderStatusBadge status={order.status as ServiceOrderStatus} />
                  ) : (
                    <Select
                      value={order.status}
                      onValueChange={(value) => {
                        if (value && value !== order.status) {
                          statusMutation.mutate({ id: order._id, status: value as ServiceOrderStatus });
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
                        onClick={() => {
                          setEditingOrder(order);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                  No service orders found.
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

      <ServiceOrderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        products={products}
        editingOrder={editingOrder}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete service order?"
        description="This will move the service order to trash."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
