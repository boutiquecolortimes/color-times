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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { staffMemberSchema, type StaffMemberInput } from "@/lib/validations/staff-member";
import { salaryPaymentSchema, type SalaryPaymentInput } from "@/lib/validations/salary-payment";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";

interface StaffRow extends StaffMemberInput {
  _id: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

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

async function fetchStaff(params: {
  status: string;
  page: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  all?: boolean;
}): Promise<{ staff: StaffRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ status: params.status, page: String(params.page) });
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.all) searchParams.set("all", "true");
  const res = await fetch(`/api/admin/staff?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function StaffClient({
  initialStaff,
  initialPagination,
}: {
  initialStaff: StaffRow[];
  initialPagination: Pagination;
}) {
  const [tab, setTab] = useState<"staff" | "payments">("staff");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the staff on payroll and record their monthly salary payments.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => value && setTab(value as "staff" | "payments")}>
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="payments">Salary Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="mt-4">
          <StaffTable initialStaff={initialStaff} initialPagination={initialPagination} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <SalaryPaymentsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StaffTable({
  initialStaff,
  initialPagination,
}: {
  initialStaff: StaffRow[];
  initialPagination: Pagination;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [status, setStatus] = useState<"active" | "trash">("active");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<StaffRow | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"delete" | "permanent-delete" | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isDefaultQuery = status === "active" && page === 1 && sortBy === "name";

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  const activeSortBy = sortBy === "name" ? undefined : sortBy;

  const { data } = useQuery({
    queryKey: ["admin", "staff", { status, page, sortBy, sortDir }],
    queryFn: () => fetchStaff({ status, page, sortBy: activeSortBy, sortDir }),
    initialData: isDefaultQuery ? { staff: initialStaff, pagination: initialPagination } : undefined,
  });

  const staff = data?.staff ?? [];
  const pagination = data?.pagination ?? initialPagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
  }

  const form = useForm<StaffMemberInput>({
    resolver: zodResolver(staffMemberSchema),
    defaultValues: {
      name: "",
      phone: "",
      designation: "",
      monthlySalary: 0,
      joiningDate: new Date().toISOString().slice(0, 10),
      isActive: true,
      notes: "",
    },
  });

  function openCreateDialog() {
    setEditing(null);
    form.reset({
      name: "",
      phone: "",
      designation: "",
      monthlySalary: 0,
      joiningDate: new Date().toISOString().slice(0, 10),
      isActive: true,
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(member: StaffRow) {
    setEditing(member);
    form.reset(member);
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: StaffMemberInput) => {
      const url = editing ? `/api/admin/staff/${editing._id}` : "/api/admin/staff";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.staff;
    },
    onSuccess: () => {
      toast.success(editing ? "Staff member updated" : "Staff member added");
      invalidate();
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Staff member moved to trash");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/staff/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Staff member restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/staff/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Staff member permanently deleted");
      invalidate();
      setPermanentDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "delete" | "restore" | "permanent-delete" }) => {
      const res = await fetch("/api/admin/staff/bulk", {
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
        toast.success(`Permanently deleted ${variables.ids.length} staff member(s)`);
      } else if (variables.action === "restore") {
        toast.success(`Restored ${variables.ids.length} staff member(s)`);
      } else {
        toast.success(`Moved ${variables.ids.length} staff member(s) to trash`);
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
    setSelectedIds((prev) => (prev.size === staff.length ? new Set() : new Set(staff.map((s) => s._id))));
  }

  function changeStatus(next: "active" | "trash") {
    setStatus(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  const exportHeaders = ["Sr No", "Name", "Designation", "Phone", "Monthly Salary", "Status", "Joining Date"];

  function staffToRows(rows: StaffRow[]): (string | number)[][] {
    return rows.map((member, index) => [
      index + 1,
      member.name,
      member.designation ?? "",
      member.phone ?? "",
      member.monthlySalary,
      member.isActive ? "Active" : "Inactive",
      formatDate(member.joiningDate),
    ]);
  }

  async function fetchAllForExport(): Promise<StaffRow[]> {
    const result = await fetchStaff({ status, page: 1, sortBy: activeSortBy, sortDir, all: true });
    return result.staff;
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{pagination.total} staff</p>
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
                    const rows = staffToRows(await fetchAllForExport());
                    await downloadExcel("staff", "Staff", exportHeaders, rows);
                  })
                }
              >
                <Table2 className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  withExportGuard(async () => {
                    const rows = staffToRows(await fetchAllForExport());
                    await downloadPdf("staff", "Staff", exportHeaders, rows);
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
              New Staff
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

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
              <th className="px-4 py-3">
                <Checkbox
                  checked={staff.length > 0 && selectedIds.size === staff.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
                  Name <SortIcon field="name" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">
                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("monthlySalary")}>
                  Monthly Salary <SortIcon field="monthlySalary" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member, index) => (
              <tr key={member._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {(pagination.page - 1) * pagination.pageSize + index + 1}
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(member._id)}
                    onCheckedChange={() => toggleSelectOne(member._id)}
                    aria-label={`Select ${member.name}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium">{member.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{member.designation || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{member.phone || "—"}</td>
                <td className="px-4 py-3">{formatCurrency(member.monthlySalary)}</td>
                <td className="px-4 py-3">
                  <Badge variant={member.isActive ? "secondary" : "outline"}>
                    {member.isActive ? "Active" : "Inactive"}
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
                          onClick={() => restoreMutation.mutate(member._id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={permanentDeleteMutation.isPending}
                          onClick={() => setPermanentDeleteTarget(member)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(member)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(member)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  {status === "trash" ? "Trash is empty." : "No staff yet. Add your first staff member."}
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
        itemLabel="staff"
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Staff Member" : "New Staff Member"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Tailor, Helper, Manager" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="monthlySalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Salary (₹)</FormLabel>
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
                  name="joiningDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joining Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox checked={field.value ?? true} onCheckedChange={(checked) => field.onChange(checked === true)} />
                      Currently active (on payroll)
                    </label>
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
                  {editing ? "Save Changes" : "Add Staff Member"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Move staff member to trash?"
        description={
          deleteTarget
            ? `Move "${deleteTarget.name}" to trash? Their salary payment history is kept and can be restored later.`
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
        title="Permanently delete staff member?"
        description={
          permanentDeleteTarget
            ? `Permanently delete "${permanentDeleteTarget.name}"? This cannot be undone.`
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
            ? `Permanently delete ${selectedIds.size} staff member(s)?`
            : `Move ${selectedIds.size} staff member(s) to trash?`
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

interface SalaryPaymentRow {
  _id: string;
  staff: { _id: string; name: string; designation?: string; phone?: string } | null;
  amount: number;
  forMonth: string;
  paymentDate: string;
  paymentMethod: SalaryPaymentInput["paymentMethod"];
  notes?: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  upi: "UPI",
  cheque: "Cheque",
  other: "Other",
};

async function fetchSalaryPayments(params: {
  status: string;
  page: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  all?: boolean;
}): Promise<{ payments: SalaryPaymentRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ status: params.status, page: String(params.page) });
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.all) searchParams.set("all", "true");
  const res = await fetch(`/api/admin/salary-payments?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function fetchActiveStaffOptions(): Promise<StaffRow[]> {
  const res = await fetch("/api/admin/staff?status=active&all=true");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.staff;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function SalaryPaymentsTable() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryPaymentRow | null>(null);
  const [status, setStatus] = useState<"active" | "trash">("active");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<SalaryPaymentRow | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<SalaryPaymentRow | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"delete" | "permanent-delete" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "salary-payments", { status, page }],
    queryFn: () => fetchSalaryPayments({ status, page }),
  });

  const { data: staffOptions = [] } = useQuery({
    queryKey: ["admin", "staff", "active-options"],
    queryFn: fetchActiveStaffOptions,
    enabled: dialogOpen,
  });

  const payments = data?.payments ?? [];
  const pagination = data?.pagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "salary-payments"] });
  }

  const form = useForm<SalaryPaymentInput>({
    resolver: zodResolver(salaryPaymentSchema),
    defaultValues: {
      staff: "",
      amount: 0,
      forMonth: currentMonth(),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "cash",
      notes: "",
    },
  });

  function openCreateDialog() {
    setEditing(null);
    form.reset({
      staff: "",
      amount: 0,
      forMonth: currentMonth(),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "cash",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(payment: SalaryPaymentRow) {
    setEditing(payment);
    form.reset({
      staff: payment.staff?._id ?? "",
      amount: payment.amount,
      forMonth: payment.forMonth,
      paymentDate: payment.paymentDate.slice(0, 10),
      paymentMethod: payment.paymentMethod,
      notes: payment.notes ?? "",
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SalaryPaymentInput) => {
      const url = editing ? `/api/admin/salary-payments/${editing._id}` : "/api/admin/salary-payments";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.payment;
    },
    onSuccess: () => {
      toast.success(editing ? "Payment updated" : "Salary payment recorded");
      invalidate();
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/salary-payments/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Payment moved to trash");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/salary-payments/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Payment restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/salary-payments/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Payment permanently deleted");
      invalidate();
      setPermanentDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "delete" | "restore" | "permanent-delete" }) => {
      const res = await fetch("/api/admin/salary-payments/bulk", {
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
        toast.success(`Permanently deleted ${variables.ids.length} payment(s)`);
      } else if (variables.action === "restore") {
        toast.success(`Restored ${variables.ids.length} payment(s)`);
      } else {
        toast.success(`Moved ${variables.ids.length} payment(s) to trash`);
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
    setSelectedIds((prev) => (prev.size === payments.length ? new Set() : new Set(payments.map((p) => p._id))));
  }

  function changeStatus(next: "active" | "trash") {
    setStatus(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  const exportHeaders = ["Sr No", "Staff", "For Month", "Amount", "Payment Date", "Method"];

  function paymentsToRows(rows: SalaryPaymentRow[]): (string | number)[][] {
    return rows.map((payment, index) => [
      index + 1,
      payment.staff?.name ?? "—",
      payment.forMonth,
      payment.amount,
      formatDate(payment.paymentDate),
      PAYMENT_METHOD_LABELS[payment.paymentMethod ?? "cash"] ?? payment.paymentMethod ?? "",
    ]);
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{pagination?.total ?? 0} payments</p>
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
                    const result = await fetchSalaryPayments({ status, page: 1, all: true });
                    await downloadExcel("salary-payments", "Salary Payments", exportHeaders, paymentsToRows(result.payments));
                  })
                }
              >
                <Table2 className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  withExportGuard(async () => {
                    const result = await fetchSalaryPayments({ status, page: 1, all: true });
                    await downloadPdf("salary-payments", "Salary Payments", exportHeaders, paymentsToRows(result.payments));
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
              Record Payment
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

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[680px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sr No</th>
              <th className="px-4 py-3">
                <Checkbox
                  checked={payments.length > 0 && selectedIds.size === payments.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">For Month</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => (
              <tr key={payment._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {((pagination?.page ?? 1) - 1) * (pagination?.pageSize ?? payments.length) + index + 1}
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(payment._id)}
                    onCheckedChange={() => toggleSelectOne(payment._id)}
                    aria-label="Select row"
                  />
                </td>
                <td className="px-4 py-3 font-medium">{payment.staff?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{payment.forMonth}</td>
                <td className="px-4 py-3">{formatCurrency(payment.amount)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(payment.paymentDate)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[payment.paymentMethod ?? "cash"] ?? payment.paymentMethod}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {status === "trash" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(payment._id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={permanentDeleteMutation.isPending}
                          onClick={() => setPermanentDeleteTarget(payment)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(payment)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(payment)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  {status === "trash" ? "Trash is empty." : "No salary payments recorded yet."}
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
          itemLabel="payments"
          onPageChange={setPage}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Salary Payment" : "Record Salary Payment"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="staff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Member</FormLabel>
                    <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {() => staffOptions.find((s) => s._id === field.value)?.name ?? "Select staff"}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {staffOptions.map((member) => (
                          <SelectItem key={member._id} value={member._id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <FormField
                  control={form.control}
                  name="forMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>For Month</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
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
                      <FormLabel>Payment Method</FormLabel>
                      <Select value={field.value ?? "cash"} onValueChange={(value) => field.onChange(value ?? "cash")}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: string) => PAYMENT_METHOD_LABELS[value] ?? value}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
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
                  {editing ? "Save Changes" : "Record Payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Move payment to trash?"
        description="You can restore it later from the Trash view."
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
        title="Permanently delete this payment?"
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
            ? `Permanently delete ${selectedIds.size} payment(s)?`
            : `Move ${selectedIds.size} payment(s) to trash?`
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
