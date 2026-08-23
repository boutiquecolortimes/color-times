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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerImportDialog } from "@/components/admin/customer-import-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";
import { formatDate, isWalkinEmail } from "@/lib/utils";

interface CustomerRow {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function fetchCustomers(params: {
  page: number;
  search: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  view?: "active" | "trash";
  all?: boolean;
}): Promise<{ customers: CustomerRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ page: String(params.page) });
  if (params.search) searchParams.set("search", params.search);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.view) searchParams.set("view", params.view);
  if (params.all) searchParams.set("all", "true");

  const res = await fetch(`/api/admin/customers?${searchParams.toString()}`);
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

export function CustomersClient({
  initialCustomers,
  initialPagination,
}: {
  initialCustomers: CustomerRow[];
  initialPagination: Pagination;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [layout, setLayout] = useState<"table" | "card">("table");
  const [trashView, setTrashView] = useState<"active" | "trash">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<CustomerRow | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"delete" | "permanent-delete" | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);

  const isDefaultQuery =
    page === 1 && search === "" && sortBy === "createdAt" && sortDir === "desc" && trashView === "active";

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
    queryKey: ["admin", "customers", { page, search, sortBy, sortDir, trashView }],
    queryFn: () => fetchCustomers({ page, search, sortBy, sortDir, view: trashView }),
    initialData: isDefaultQuery
      ? { customers: initialCustomers, pagination: initialPagination }
      : undefined,
  });

  const customers = data?.customers ?? [];
  const pagination = data?.pagination ?? initialPagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
  }

  const exportHeaders = ["Sr No", "Name", "Email", "Phone", "Joined"];

  function customersToRows(rows: CustomerRow[]): (string | number)[][] {
    return rows.map((customer, index) => [
      index + 1,
      customer.name,
      isWalkinEmail(customer.email) ? "—" : customer.email,
      customer.phone ?? "—",
      formatDate(customer.createdAt),
    ]);
  }

  async function fetchAllCustomersForExport(): Promise<CustomerRow[]> {
    const result = await fetchCustomers({ page: 1, search, sortBy, sortDir, view: trashView, all: true });
    return result.customers;
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
      const rows = customersToRows(await fetchAllCustomersForExport());
      await downloadExcel("customers", "Customers", exportHeaders, rows);
    });
  }

  function handleExportPdf() {
    void withExportGuard(async () => {
      const rows = customersToRows(await fetchAllCustomersForExport());
      await downloadPdf("customers", "Customers", exportHeaders, rows);
    });
  }

  function handlePrint() {
    window.print();
  }

  function changeTrashView(next: "active" | "trash") {
    setTrashView(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/customers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Customer moved to trash");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/customers/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Customer restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/customers/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Customer permanently deleted");
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
      const res = await fetch("/api/admin/customers/bulk", {
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
        const { deleted, blocked } = data as {
          deleted: number;
          blocked: { name: string; bookingCount: number; invoiceCount: number; reviewCount: number }[];
        };
        if (deleted > 0) {
          toast.success(`Permanently deleted ${deleted} customer(s)`);
        }
        if (blocked.length > 0) {
          toast.warning(
            `Skipped ${blocked.length} customer(s) with booking, invoice, or review history: ${blocked
              .map((b) => b.name)
              .join(", ")}`,
            { duration: 8000 }
          );
        }
      } else if (variables.action === "restore") {
        toast.success(`Restored ${variables.ids.length} customer(s)`);
      } else {
        toast.success(`Moved ${variables.ids.length} customer(s) to trash`);
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
    setSelectedIds((prev) =>
      prev.size === customers.length ? new Set() : new Set(customers.map((c) => c._id))
    );
  }

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {customers.map((customer) => (
        <div key={customer._id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <Checkbox
              checked={selectedIds.has(customer._id)}
              onCheckedChange={() => toggleSelectOne(customer._id)}
              aria-label={`Select ${customer.name}`}
            />
          </div>
          <p className="mt-2 font-medium">{customer.name}</p>
          <p className="text-sm text-muted-foreground">
            {isWalkinEmail(customer.email) ? "—" : customer.email}
          </p>
          <p className="text-sm text-muted-foreground">{customer.phone ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Joined {formatDate(customer.createdAt)}
          </p>
          <div className="mt-3 flex justify-end gap-1">
            {trashView === "trash" ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Restore customer"
                  title="Restore"
                  disabled={restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate(customer._id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label="Delete customer permanently"
                  title="Delete permanently"
                  disabled={permanentDeleteMutation.isPending}
                  onClick={() => setPermanentDeleteTarget(customer)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <ButtonLink variant="outline" size="sm" href={`/admin/customers/${customer._id}`}>
                  View
                </ButtonLink>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label="Delete customer"
                  title="Move to trash"
                  disabled={deleteMutation.isPending}
                  onClick={() => setDeleteTarget(customer)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      {customers.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">
          {trashView === "trash" ? "Trash is empty." : "No customers found."}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={trashView}
            onValueChange={(value) => changeTrashView((value ?? "active") as "active" | "trash")}
          >
            <SelectTrigger className="w-32">
              <SelectValue>{(value: string) => (value === "trash" ? "Trash" : "Active")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trash">Trash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{pagination.total} customers</p>
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
          <CustomerImportDialog />
          <ButtonLink href="/admin/customers/new" size="sm">
            New Customer
          </ButtonLink>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {trashView === "trash" ? (
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
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
              <th className="px-4 py-3">
                <Checkbox
                  checked={customers.length > 0 && selectedIds.size === customers.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
                  Name <SortIcon field="name" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("email")}>
                  Email <SortIcon field="email" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("createdAt")}>
                  Joined <SortIcon field="createdAt" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, index) => (
              <tr key={customer._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {(pagination.page - 1) * pagination.pageSize + index + 1}
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(customer._id)}
                    onCheckedChange={() => toggleSelectOne(customer._id)}
                    aria-label={`Select ${customer.name}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium">{customer.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {isWalkinEmail(customer.email) ? "—" : customer.email}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{customer.phone ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(customer.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {trashView === "trash" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Restore customer"
                          title="Restore"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(customer._id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label="Delete customer permanently"
                          title="Delete permanently"
                          disabled={permanentDeleteMutation.isPending}
                          onClick={() => setPermanentDeleteTarget(customer)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <ButtonLink
                          variant="ghost"
                          size="sm"
                          href={`/admin/customers/${customer._id}`}
                        >
                          View
                        </ButtonLink>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label="Delete customer"
                          title="Move to trash"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(customer)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {trashView === "trash" ? "Trash is empty." : "No customers found."}
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
        itemLabel="customers"
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Move customer to trash?"
        description={
          deleteTarget
            ? `Move "${deleteTarget.name}" to trash? Their account will be disabled and they'll disappear from this list until restored.`
            : ""
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
        title="Permanently delete customer?"
        description={
          permanentDeleteTarget
            ? `Permanently delete "${permanentDeleteTarget.name}"? This cannot be undone. Blocked automatically if any booking, invoice, or review still references them.`
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
            ? `Permanently delete ${selectedIds.size} customer(s)?`
            : `Move ${selectedIds.size} customer(s) to trash?`
        }
        description={
          bulkConfirmAction === "permanent-delete"
            ? "This cannot be undone. Any selected customer with booking, invoice, or review history will be skipped automatically and reported back."
            : "Their accounts will be disabled. You can restore them from the Trash view at any time."
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
