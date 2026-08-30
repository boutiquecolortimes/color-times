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
import { expenseSchema, type ExpenseInput } from "@/lib/validations/expense";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";

interface ExpenseRow extends ExpenseInput {
  _id: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

const ALL_CATEGORIES_VALUE = "__all__";

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

async function fetchExpenses(params: {
  status: string;
  category?: string;
  page: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  all?: boolean;
}): Promise<{ expenses: ExpenseRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ status: params.status, page: String(params.page) });
  if (params.category) searchParams.set("category", params.category);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.all) searchParams.set("all", "true");
  const res = await fetch(`/api/admin/expenses?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function ExpensesClient({
  initialExpenses,
  initialPagination,
}: {
  initialExpenses: ExpenseRow[];
  initialPagination: Pagination;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [status, setStatus] = useState<"active" | "trash">("active");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES_VALUE);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("expenseDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<ExpenseRow | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"delete" | "permanent-delete" | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeCategory = category === ALL_CATEGORIES_VALUE ? undefined : category;
  const isDefaultQuery =
    status === "active" && !activeCategory && page === 1 && sortBy === "expenseDate" && sortDir === "desc";

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
    queryKey: ["admin", "expenses", { status, category: activeCategory, page, sortBy, sortDir }],
    queryFn: () => fetchExpenses({ status, category: activeCategory, page, sortBy, sortDir }),
    initialData: isDefaultQuery ? { expenses: initialExpenses, pagination: initialPagination } : undefined,
  });

  const expenses = data?.expenses ?? [];
  const pagination = data?.pagination ?? initialPagination;
  const pageTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "expenses"] });
  }

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: "miscellaneous",
      description: "",
      amount: 0,
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "",
      notes: "",
    },
  });

  function openCreateDialog() {
    setEditing(null);
    form.reset({
      category: "miscellaneous",
      description: "",
      amount: 0,
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(expense: ExpenseRow) {
    setEditing(expense);
    form.reset(expense);
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ExpenseInput) => {
      const url = editing ? `/api/admin/expenses/${editing._id}` : "/api/admin/expenses";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.expense;
    },
    onSuccess: () => {
      toast.success(editing ? "Expense updated" : "Expense recorded");
      invalidate();
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Expense moved to trash");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/expenses/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Expense restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/expenses/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Expense permanently deleted");
      invalidate();
      setPermanentDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "delete" | "restore" | "permanent-delete" }) => {
      const res = await fetch("/api/admin/expenses/bulk", {
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
        toast.success(`Permanently deleted ${variables.ids.length} expense(s)`);
      } else if (variables.action === "restore") {
        toast.success(`Restored ${variables.ids.length} expense(s)`);
      } else {
        toast.success(`Moved ${variables.ids.length} expense(s) to trash`);
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
    setSelectedIds((prev) => (prev.size === expenses.length ? new Set() : new Set(expenses.map((e) => e._id))));
  }

  function changeStatus(next: "active" | "trash") {
    setStatus(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  function changeCategory(next: string) {
    setCategory(next);
    setPage(1);
  }

  const exportHeaders = ["Sr No", "Description", "Category", "Amount", "Date", "Payment Method"];

  function expensesToRows(rows: ExpenseRow[]): (string | number)[][] {
    return rows.map((expense, index) => [
      index + 1,
      expense.description,
      EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category,
      expense.amount,
      formatDate(expense.expenseDate),
      expense.paymentMethod ?? "",
    ]);
  }

  async function fetchAllForExport(): Promise<ExpenseRow[]> {
    const result = await fetchExpenses({ status, category: activeCategory, page: 1, sortBy, sortDir, all: true });
    return result.expenses;
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
        <h1 className="font-heading text-2xl">Expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track rent, electricity, and other day-to-day business costs — separate from staff salary
          and dress purchases, which have their own menus.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {pagination.total} expenses &middot; {formatCurrency(pageTotal)} on this page
          </p>
          <Select value={status} onValueChange={(value) => changeStatus((value ?? "active") as "active" | "trash")}>
            <SelectTrigger className="w-32">
              <SelectValue>{(value: string) => (value === "trash" ? "Trash" : "Active")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trash">Trash</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(value) => changeCategory(value ?? ALL_CATEGORIES_VALUE)}>
            <SelectTrigger className="w-44">
              <SelectValue>
                {(value: string) =>
                  value === ALL_CATEGORIES_VALUE ? "All Categories" : EXPENSE_CATEGORY_LABELS[value] ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES_VALUE}>All Categories</SelectItem>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
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
                    const rows = expensesToRows(await fetchAllForExport());
                    await downloadExcel("expenses", "Expenses", exportHeaders, rows);
                  })
                }
              >
                <Table2 className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  withExportGuard(async () => {
                    const rows = expensesToRows(await fetchAllForExport());
                    await downloadPdf("expenses", "Expenses", exportHeaders, rows);
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
            <Button onClick={openCreateDialog} className="rounded-md">
              <Plus className="h-4 w-4" />
              New Expense
            </Button>
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

      <div className="lg:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {expenses.map((expense) => (
            <div key={expense._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedIds.has(expense._id)}
                    onCheckedChange={() => toggleSelectOne(expense._id)}
                    aria-label={`Select ${expense.description}`}
                  />
                  <p className="font-medium">{expense.description}</p>
                </div>
                <Badge variant="outline">{EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Amount</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(expense.amount)}
                </span>
                <span>Date</span>
                <span className="text-right text-foreground">{formatDate(expense.expenseDate)}</span>
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
                      onClick={() => restoreMutation.mutate(expense._id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={permanentDeleteMutation.isPending}
                      onClick={() => setPermanentDeleteTarget(expense)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(expense)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteTarget(expense)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {status === "trash" ? "Trash is empty." : "No expenses yet. Record your first one."}
            </p>
          )}
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[720px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
              <th className="px-4 py-3">
                <Checkbox
                  checked={expenses.length > 0 && selectedIds.size === expenses.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("description")}>
                  Description <SortIcon field="description" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("category")}>
                  Category <SortIcon field="category" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("amount")}>
                  Amount <SortIcon field="amount" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("expenseDate")}>
                  Date <SortIcon field="expenseDate" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense, index) => (
              <tr key={expense._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {(pagination.page - 1) * pagination.pageSize + index + 1}
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(expense._id)}
                    onCheckedChange={() => toggleSelectOne(expense._id)}
                    aria-label={`Select ${expense.description}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium">{expense.description}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}</Badge>
                </td>
                <td className="px-4 py-3">{formatCurrency(expense.amount)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(expense.expenseDate)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {status === "trash" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(expense._id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={permanentDeleteMutation.isPending}
                          onClick={() => setPermanentDeleteTarget(expense)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(expense)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(expense)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {status === "trash" ? "Trash is empty." : "No expenses yet. Record your first one."}
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
        itemLabel="expenses"
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "New Expense"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Shop rent for August" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "miscellaneous")}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>{(value: string) => EXPENSE_CATEGORY_LABELS[value] ?? value}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
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
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹)</FormLabel>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Cash, UPI" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                  {editing ? "Save Changes" : "Record Expense"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Move expense to trash?"
        description={
          deleteTarget ? `Move "${deleteTarget.description}" to trash? You can restore it later.` : ""
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
        title="Permanently delete this expense?"
        description="This cannot be undone."
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
            ? `Permanently delete ${selectedIds.size} expense(s)?`
            : `Move ${selectedIds.size} expense(s) to trash?`
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
