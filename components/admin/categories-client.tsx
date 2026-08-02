"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  FileDown,
  Grid3x3,
  List,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Table2,
  Trash2,
} from "lucide-react";
import Image from "next/image";
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
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { categorySchema, type CategoryInput } from "@/lib/validations/category";
import { downloadExcel, downloadPdf } from "@/lib/admin/export";

interface CategoryRow extends CategoryInput {
  _id: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function fetchCategories(params: {
  status: string;
  page: number;
  all?: boolean;
}): Promise<{ categories: CategoryRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ status: params.status, page: String(params.page) });
  if (params.all) searchParams.set("all", "true");
  const res = await fetch(`/api/admin/categories?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoriesClient({
  initialCategories,
  initialPagination,
}: {
  initialCategories: CategoryRow[];
  initialPagination: Pagination;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [view, setView] = useState<"table" | "card">("table");
  const [status, setStatus] = useState<"active" | "trash">("active");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<CategoryRow | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"delete" | "permanent-delete" | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isDefaultQuery = status === "active" && page === 1;

  const { data } = useQuery({
    queryKey: ["admin", "categories", { status, page }],
    queryFn: () => fetchCategories({ status, page }),
    initialData: isDefaultQuery
      ? { categories: initialCategories, pagination: initialPagination }
      : undefined,
  });

  const categories = data?.categories ?? [];
  const pagination = data?.pagination ?? initialPagination;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
  }

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      heroImage: "",
    },
  });

  function openCreateDialog() {
    setEditing(null);
    form.reset({
      name: "",
      slug: "",
      description: "",
      heroImage: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(category: CategoryRow) {
    setEditing(category);
    form.reset(category);
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: CategoryInput) => {
      const url = editing ? `/api/admin/categories/${editing._id}` : "/api/admin/categories";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.category;
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated" : "Category created");
      invalidate();
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Category moved to trash");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/categories/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Category restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/categories/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Category permanently deleted");
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
      const res = await fetch("/api/admin/categories/bulk", {
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
          blocked: { name: string; productCount: number }[];
        };
        if (deleted > 0) {
          toast.success(`Permanently deleted ${deleted} categor${deleted === 1 ? "y" : "ies"}`);
        }
        if (blocked.length > 0) {
          toast.warning(
            `Skipped ${blocked.length} categor${blocked.length === 1 ? "y" : "ies"} still in use: ${blocked
              .map((b) => `${b.name} (${b.productCount} product${b.productCount === 1 ? "" : "s"})`)
              .join(", ")}`,
            { duration: 8000 }
          );
        }
      } else if (variables.action === "restore") {
        toast.success(`Restored ${variables.ids.length} categor${variables.ids.length === 1 ? "y" : "ies"}`);
      } else {
        toast.success(`Moved ${variables.ids.length} categor${variables.ids.length === 1 ? "y" : "ies"} to trash`);
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
      prev.size === categories.length ? new Set() : new Set(categories.map((c) => c._id))
    );
  }

  function changeStatus(next: "active" | "trash") {
    setStatus(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  const exportHeaders = ["Name", "Slug", "Description"];

  function categoriesToRows(rows: CategoryRow[]): (string | number)[][] {
    return rows.map((category) => [category.name, category.slug, category.description ?? ""]);
  }

  async function fetchAllCategoriesForExport(): Promise<CategoryRow[]> {
    const result = await fetchCategories({ status, page: 1, all: true });
    return result.categories;
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
      const rows = categoriesToRows(await fetchAllCategoriesForExport());
      await downloadExcel("categories", "Categories", exportHeaders, rows);
    });
  }

  function handleExportPdf() {
    void withExportGuard(async () => {
      const rows = categoriesToRows(await fetchAllCategoriesForExport());
      await downloadPdf("categories", "Categories", exportHeaders, rows);
    });
  }

  function handlePrint() {
    window.print();
  }

  const cardGrid = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {categories.map((category) => (
        <div key={category._id} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative aspect-square bg-secondary">
            {category.heroImage && (
              <Image
                src={category.heroImage}
                alt={category.name}
                fill
                sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            )}
            <div className="absolute left-2 top-2 rounded bg-background/80 p-0.5">
              <Checkbox
                checked={selectedIds.has(category._id)}
                onCheckedChange={() => toggleSelectOne(category._id)}
                aria-label={`Select ${category.name}`}
              />
            </div>
          </div>
          <div className="p-3">
            <p className="truncate text-sm font-medium">{category.name}</p>
            <p className="truncate text-xs text-muted-foreground">{category.slug}</p>
            <div className="mt-2 flex justify-end gap-1">
              {status === "trash" ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(category._id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    disabled={permanentDeleteMutation.isPending}
                    onClick={() => setPermanentDeleteTarget(category)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(category)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => setDeleteTarget(category)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      {categories.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">
          {status === "trash" ? "Trash is empty." : "No categories yet. Create your first one."}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{pagination.total} categories</p>
          <Select value={status} onValueChange={(value) => changeStatus((value ?? "active") as "active" | "trash")}>
            <SelectTrigger className="w-32">
              <SelectValue>{(value: string) => (value === "trash" ? "Trash" : "Active")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trash">Trash</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden items-center gap-1 rounded-md border border-border p-1 lg:flex">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("table")}
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "card" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("card")}
              aria-label="Card view"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {status === "active" && (
            <Button onClick={openCreateDialog} className="rounded-md">
              <Plus className="h-4 w-4" />
              New Category
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

      {view === "card" ? (
        <div className="hidden lg:block">{cardGrid}</div>
      ) : (
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                <Checkbox
                  checked={categories.length > 0 && selectedIds.size === categories.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(category._id)}
                    onCheckedChange={() => toggleSelectOne(category._id)}
                    aria-label={`Select ${category.name}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-md bg-secondary">
                    {category.heroImage && (
                      <Image src={category.heroImage} alt={category.name} fill sizes="40px" className="object-cover" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{category.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{category.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {status === "trash" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(category._id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={permanentDeleteMutation.isPending}
                          onClick={() => setPermanentDeleteTarget(category)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(category)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(category)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {status === "trash" ? "Trash is empty." : "No categories yet. Create your first one."}
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
        itemLabel="categories"
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          if (!editing) {
                            form.setValue("slug", slugify(event.target.value));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heroImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hero Image (optional)</FormLabel>
                    <FormControl>
                      <ImageUploadField
                        images={field.value ? [field.value] : []}
                        onChange={(images) => field.onChange(images[0] ?? "")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Save Changes" : "Create Category"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Move category to trash?"
        description={
          deleteTarget
            ? `Move "${deleteTarget.name}" to trash? You can restore it later from the Trash view.`
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
        title="Permanently delete category?"
        description={
          permanentDeleteTarget
            ? `Permanently delete "${permanentDeleteTarget.name}"? This cannot be undone. Blocked automatically if any product still uses it.`
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
            ? `Permanently delete ${selectedIds.size} categor${selectedIds.size === 1 ? "y" : "ies"}?`
            : `Move ${selectedIds.size} categor${selectedIds.size === 1 ? "y" : "ies"} to trash?`
        }
        description={
          bulkConfirmAction === "permanent-delete"
            ? "This cannot be undone. Any selected category that still has products in it will be skipped automatically and reported back."
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
