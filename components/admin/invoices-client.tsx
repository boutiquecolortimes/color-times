"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileDown,
  Grid3x3,
  List,
  MoreHorizontal,
  Printer,
  RotateCcw,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceStatusBadge } from "@/components/admin/invoice-status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { downloadPdf, downloadExcel } from "@/lib/admin/export";
import { customerContact, formatDate } from "@/lib/utils";
import type { InvoiceStatus } from "@/models/Invoice";

interface InvoiceRow {
  _id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  total: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string;
  createdAt: string;
  customer: { name: string; email: string; phone?: string } | null;
  booking: { bookingNumber: string } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

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

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

async function fetchInvoices(params: {
  page: number;
  status: string;
  view: string;
  search: string;
  sortBy: string;
  sortDir: string;
  all?: boolean;
}): Promise<{ invoices: InvoiceRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    view: params.view,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);
  if (params.all) searchParams.set("all", "true");

  const res = await fetch(`/api/admin/invoices?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function InvoicesClient({
  initialInvoices,
  initialPagination,
}: {
  initialInvoices: InvoiceRow[];
  initialPagination: Pagination;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"active" | "trash">("active");
  const [layout, setLayout] = useState<"table" | "card">("table");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirmState, setConfirmState] = useState<{ type: "cancel" | "delete"; id: string } | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<InvoiceRow | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"delete" | "permanent-delete" | null>(
    null
  );

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function withExportGuard(action: () => Promise<void>): Promise<void> {
    setIsExporting(true);
    try {
      await action();
    } finally {
      setIsExporting(false);
    }
  }

  const isDefaultQuery =
    page === 1 && status === "all" && view === "active" && search === "" && sortBy === "createdAt" && sortDir === "desc";

  const { data } = useQuery({
    queryKey: ["admin", "invoices", { page, status, view, search, sortBy, sortDir }],
    queryFn: () => fetchInvoices({ page, status, view, search, sortBy, sortDir }),
    initialData: isDefaultQuery
      ? { invoices: initialInvoices, pagination: initialPagination }
      : undefined,
  });

  const invoices = data?.invoices ?? [];
  const pagination = data?.pagination ?? initialPagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
  }

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/invoices/${id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.invoice;
    },
    onSuccess: () => {
      toast.success("Invoice sent");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/invoices/${id}/cancel`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.invoice;
    },
    onSuccess: () => {
      toast.success("Invoice cancelled");
      invalidate();
      setConfirmState(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/invoices/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Invoice moved to trash");
      invalidate();
      setConfirmState(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/invoices/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.invoice;
    },
    onSuccess: () => {
      toast.success("Invoice restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/invoices/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Invoice permanently deleted");
      invalidate();
      setPermanentDeleteTarget(null);
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
      const res = await fetch("/api/admin/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (data, variables) => {
      if (variables.action === "permanent-delete") {
        const { deleted } = data as { deleted: number };
        if (deleted > 0) toast.success(`Permanently deleted ${deleted} invoice(s)`);
      } else if (variables.action === "restore") {
        toast.success(`Restored ${variables.ids.length} invoice(s)`);
      } else {
        const { deleted, blocked } = data as {
          deleted: number;
          blocked: { invoiceNumber: string; status: string }[];
        };
        if (deleted > 0) toast.success(`Moved ${deleted} invoice(s) to trash`);
        if (blocked.length > 0) {
          toast.warning(
            `Skipped ${blocked.length} invoice(s) that aren't draft or cancelled: ${blocked
              .map((b) => b.invoiceNumber)
              .join(", ")}`,
            { duration: 8000 }
          );
        }
      }
      invalidate();
      clearSelection();
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
    setSelectedIds((prev) =>
      prev.size === invoices.length ? new Set() : new Set(invoices.map((invoice) => invoice._id))
    );
  }

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  async function exportRows(): Promise<{
    headers: string[];
    rows: (string | number)[][];
    totals: (string | number)[];
  }> {
    const full = await fetchInvoices({ page: 1, status, view, search, sortBy, sortDir, all: true });
    const headers = ["Sr No", "Invoice #", "Customer", "Total", "Paid", "Due", "Status", "Due Date"];
    const rows = full.invoices.map((invoice, index) => [
      index + 1,
      invoice.invoiceNumber,
      invoice.customer?.name ?? "—",
      invoice.total,
      invoice.amountPaid,
      invoice.amountDue,
      STATUS_FILTERS.find((option) => option.value === invoice.status)?.label ?? invoice.status,
      formatDate(invoice.dueDate),
    ]);
    const totals = [
      "",
      "TOTAL",
      "",
      full.invoices.reduce((sum, invoice) => sum + invoice.total, 0),
      full.invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      full.invoices.reduce((sum, invoice) => sum + invoice.amountDue, 0),
      "",
      "",
    ];
    return { headers, rows, totals };
  }

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {invoices.map((invoice) => (
        <div key={invoice._id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Checkbox
                checked={selectedIds.has(invoice._id)}
                onCheckedChange={() => toggleSelectOne(invoice._id)}
                aria-label={`Select ${invoice.invoiceNumber}`}
              />
              <Link href={`/admin/invoices/${invoice._id}`} className="truncate font-medium hover:text-accent">
                {invoice.invoiceNumber}
              </Link>
            </div>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="mt-2 text-sm">{invoice.customer?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {invoice.customer ? customerContact(invoice.customer) : "—"}
          </p>
          {invoice.booking && (
            <p className="mt-1 text-xs text-muted-foreground">Booking {invoice.booking.bookingNumber}</p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p>{formatCurrency(invoice.total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-emerald-700">{formatCurrency(invoice.amountPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due</p>
              <p className={invoice.amountDue > 0 ? "text-red-700" : undefined}>
                {formatCurrency(invoice.amountDue)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Due {formatDate(invoice.dueDate)}</p>
          <div className="mt-3 flex justify-end gap-2">
            {view === "trash" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate(invoice._id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label="Delete permanently"
                  title="Delete permanently"
                  disabled={permanentDeleteMutation.isPending}
                  onClick={() => setPermanentDeleteTarget(invoice)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                  Actions <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push(`/admin/invoices/${invoice._id}`)}>
                    View
                  </DropdownMenuItem>
                  {invoice.status === "draft" && (
                    <DropdownMenuItem onClick={() => sendMutation.mutate(invoice._id)}>
                      Send
                    </DropdownMenuItem>
                  )}
                  {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                    <DropdownMenuItem
                      onClick={() => setConfirmState({ type: "cancel", id: invoice._id })}
                    >
                      Cancel
                    </DropdownMenuItem>
                  )}
                  {(invoice.status === "draft" || invoice.status === "cancelled") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setConfirmState({ type: "delete", id: invoice._id })}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      ))}
      {invoices.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">No invoices found.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Billing, invoicing, and payment tracking.
          </p>
        </div>
        <ButtonLink href="/admin/invoices/new">New Invoice</ButtonLink>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice number..."
            className="w-64 pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              clearSelection();
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value ?? "all");
            setPage(1);
            clearSelection();
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              {(value: string) =>
                STATUS_FILTERS.find((option) => option.value === value)?.label ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={view}
          onValueChange={(value) => {
            setView((value as "active" | "trash") ?? "active");
            setPage(1);
            clearSelection();
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

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() =>
              withExportGuard(async () => {
                const { headers, rows, totals } = await exportRows();
                await downloadExcel("invoices", "Invoices", headers, rows, totals);
              })
            }
          >
            <Table2 className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() =>
              withExportGuard(async () => {
                const { headers, rows, totals } = await exportRows();
                await downloadPdf("invoices", "Invoices", headers, rows, totals);
              })
            }
          >
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
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
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={bulkActionMutation.isPending}
                  onClick={() => setBulkConfirmAction("permanent-delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Permanently
                </Button>
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
            <Button size="sm" variant="ghost" onClick={clearSelection}>
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
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
              <th className="px-4 py-3">
                <Checkbox
                  checked={invoices.length > 0 && selectedIds.size === invoices.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">
                <button className="flex items-center gap-1" onClick={() => toggleSort("invoiceNumber")}>
                  Invoice # <SortIcon field="invoiceNumber" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Booking</th>
              <th className="px-4 py-3">
                <button className="flex items-center gap-1" onClick={() => toggleSort("total")}>
                  Total <SortIcon field="total" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">
                <button className="flex items-center gap-1" onClick={() => toggleSort("amountDue")}>
                  Due <SortIcon field="amountDue" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">
                <button className="flex items-center gap-1" onClick={() => toggleSort("dueDate")}>
                  Due Date <SortIcon field="dueDate" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice, index) => (
              <tr key={invoice._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {(pagination.page - 1) * pagination.pageSize + index + 1}
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(invoice._id)}
                    onCheckedChange={() => toggleSelectOne(invoice._id)}
                    aria-label={`Select ${invoice.invoiceNumber}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/invoices/${invoice._id}`} className="hover:text-accent">
                    {invoice.invoiceNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p>{invoice.customer?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.customer ? customerContact(invoice.customer) : "—"}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {invoice.booking?.bookingNumber ?? "—"}
                </td>
                <td className="px-4 py-3">{formatCurrency(invoice.total)}</td>
                <td className="px-4 py-3 text-emerald-700">{formatCurrency(invoice.amountPaid)}</td>
                <td className="px-4 py-3">
                  {invoice.amountDue > 0 ? (
                    <span className="text-red-700">{formatCurrency(invoice.amountDue)}</span>
                  ) : (
                    formatCurrency(0)
                  )}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={invoice.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(invoice.dueDate)}
                </td>
                <td className="px-4 py-3 text-right">
                  {view === "trash" ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoreMutation.isPending}
                        onClick={() => restoreMutation.mutate(invoice._id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label="Delete permanently"
                        title="Delete permanently"
                        disabled={permanentDeleteMutation.isPending}
                        onClick={() => setPermanentDeleteTarget(invoice)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/admin/invoices/${invoice._id}`)}>
                          View
                        </DropdownMenuItem>
                        {invoice.status === "draft" && (
                          <DropdownMenuItem onClick={() => sendMutation.mutate(invoice._id)}>
                            Send
                          </DropdownMenuItem>
                        )}
                        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                          <DropdownMenuItem
                            onClick={() => setConfirmState({ type: "cancel", id: invoice._id })}
                          >
                            Cancel
                          </DropdownMenuItem>
                        )}
                        {(invoice.status === "draft" || invoice.status === "cancelled") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setConfirmState({ type: "delete", id: invoice._id })}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  No invoices found.
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
        itemLabel="invoices"
        onPageChange={(nextPage) => {
          setPage(nextPage);
          clearSelection();
        }}
      />

      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={confirmState?.type === "delete" ? "Delete invoice?" : "Cancel invoice?"}
        description={
          confirmState?.type === "delete"
            ? "This will move the invoice to trash. You can restore it later."
            : "This will mark the invoice as cancelled. This cannot be undone."
        }
        confirmLabel={confirmState?.type === "delete" ? "Delete" : "Cancel Invoice"}
        variant="destructive"
        isLoading={deleteMutation.isPending || cancelMutation.isPending}
        onConfirm={() => {
          if (!confirmState) return;
          if (confirmState.type === "delete") deleteMutation.mutate(confirmState.id);
          else cancelMutation.mutate(confirmState.id);
        }}
      />

      <ConfirmDialog
        open={permanentDeleteTarget !== null}
        onOpenChange={(open) => !open && setPermanentDeleteTarget(null)}
        title="Permanently delete invoice?"
        description={
          permanentDeleteTarget
            ? `Permanently delete ${permanentDeleteTarget.invoiceNumber}? This cannot be undone.`
            : ""
        }
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
            ? `Permanently delete ${selectedIds.size} invoice(s)?`
            : `Move ${selectedIds.size} invoice(s) to trash?`
        }
        description={
          bulkConfirmAction === "permanent-delete"
            ? "This cannot be undone."
            : "Only draft or cancelled invoices can be moved to trash — any others selected will be skipped and reported back. You can restore these from the Trash view at any time."
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
