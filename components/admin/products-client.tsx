"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileDown,
  Grid3x3,
  List,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  Settings2,
  Star,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColumnVisibilityMenu } from "@/components/admin/column-visibility-menu";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ProductsBulkToolbar } from "@/components/admin/products-bulk-toolbar";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ProductImportDialog } from "@/components/admin/product-import-dialog";
import { ProductDetailDrawer } from "@/components/admin/product-detail-drawer";
import { ImagePreviewDialog } from "@/components/admin/image-preview-dialog";
import { ProductStatusBadge } from "@/components/admin/product-status-badge";
import { useCanEdit } from "@/components/admin/current-user-context";
import { downloadPdf, downloadExcel } from "@/lib/admin/export";
import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/models/Product";

interface ProductRow {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  images: string[];
  category: { _id: string; name: string } | null;
  rentalPricePerDay: number;
  status: ProductStatus;
  isActive: boolean;
  isFeatured: boolean;
  isFavorited?: boolean;
  tags?: string[];
  variants: { size: string; quantityInStock: number }[];
  createdAt?: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CategoryOption {
  _id: string;
  name: string;
  slug: string;
}

interface ProductsResponse {
  products: ProductRow[];
  pagination: Pagination;
}

const COLUMN_DEFS = [
  { key: "category", label: "Category" },
  { key: "price", label: "Rent" },
  { key: "status", label: "Status" },
];

async function fetchProducts(params: {
  page: number;
  search: string;
  category: string;
  status: string;
  sortBy: string;
  sortDir: string;
  all?: boolean;
}): Promise<ProductsResponse> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    status: params.status,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  if (params.search) searchParams.set("search", params.search);
  if (params.category && params.category !== "all") searchParams.set("category", params.category);
  if (params.all) searchParams.set("all", "true");

  const res = await fetch(`/api/admin/products?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

function totalStock(variants: ProductRow["variants"]): number {
  return variants.reduce((sum, variant) => sum + variant.quantityInStock, 0);
}

// Products created without an uploaded photo fall back to a generic
// placeholder path (old dress stock photos or the current logo default) —
// treat any of those as "no real image" so the store logo shows instead.
function hasRealImage(images: string[]): boolean {
  const first = images[0];
  return Boolean(first) && !first.startsWith("/images/placeholder/");
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

export function ProductsClient({
  initialProducts,
  initialPagination,
  categories,
  canManageSettings,
}: {
  initialProducts: ProductRow[];
  initialPagination: Pagination;
  categories: CategoryOption[];
  canManageSettings: boolean;
}) {
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("active");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    category: true,
    price: true,
    status: true,
  });
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

  // Deep link support: a low-stock notification (and anything else that
  // wants to point someone at a specific product) links here with
  // ?view={id} rather than straight to /admin/products/{id}, since that
  // route is now the edit form and Staff is redirected away from it. The
  // read-only drawer works for every role, so open it on landing and then
  // drop the param so the URL doesn't stay "sticky" across reloads.
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam) {
      setViewingId(viewParam);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("view");
      const query = next.toString();
      router.replace(query ? `/admin/products?${query}` : "/admin/products");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isExporting, setIsExporting] = useState(false);
  const [previewProductId, setPreviewProductId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [confirmState, setConfirmState] = useState<{
    ids: string[];
    action: "delete" | "permanent-delete" | "archive" | "restore";
  } | null>(null);

  const isDefaultQuery =
    page === 1 && search === "" && category === "all" && status === "active" &&
    sortBy === "createdAt" && sortDir === "desc";

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "products", { page, search, category, status, sortBy, sortDir }],
    queryFn: () => fetchProducts({ page, search, category, status, sortBy, sortDir }),
    initialData: isDefaultQuery
      ? { products: initialProducts, pagination: initialPagination }
      : undefined,
  });

  const products = useMemo(() => data?.products ?? [], [data]);
  const pagination = data?.pagination ?? initialPagination;

  const { data: inventorySettings } = useQuery({
    queryKey: ["admin", "settings", "inventory"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings/inventory");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.settings as { lowStockThreshold: number };
    },
    staleTime: 5 * 60 * 1000,
  });
  const lowStockThreshold = inventorySettings?.lowStockThreshold ?? 3;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
  }

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}/archive`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Product archived");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Product restored");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const trashMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Product moved to trash");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}/permanent`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Product permanently deleted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}/duplicate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Product duplicated as a draft");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorited }: { id: string; isFavorited: boolean }) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorited }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const setCoverMutation = useMutation({
    mutationFn: async ({ id, images }: { id: string; images: string[] }) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Cover image updated");
      invalidate();
      setPreviewIndex(0);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewProduct = products.find((product) => product._id === previewProductId) ?? null;

  function openPreview(product: ProductRow, index: number) {
    setPreviewProductId(product._id);
    setPreviewIndex(index);
  }

  function setCoverImage(index: number) {
    if (!previewProduct || index <= 0 || index >= previewProduct.images.length) return;
    const { images } = previewProduct;
    setCoverMutation.mutate({
      id: previewProduct._id,
      images: [images[index], ...images.slice(0, index), ...images.slice(index + 1)],
    });
  }

  const inlinePriceMutation = useMutation({
    mutationFn: async ({ id, rentalPricePerDay }: { id: string; rentalPricePerDay: number }) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalPricePerDay }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Price updated");
      invalidate();
      setEditingPriceId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setEditingPriceId(null);
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({
      ids,
      action,
    }: {
      ids: string[];
      action: "archive" | "restore" | "delete" | "permanent-delete" | "activate" | "deactivate";
    }) => {
      const res = await fetch("/api/admin/products/bulk", {
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
          blocked: { name: string; sku: string }[];
        };
        if (deleted > 0) {
          toast.success(`Permanently deleted ${deleted} product(s)`);
        }
        if (blocked.length > 0) {
          toast.warning(
            `Skipped ${blocked.length} product(s) with booking or service history: ${blocked
              .map((b) => `${b.name} (${b.sku})`)
              .join(", ")}`,
            { duration: 8000 }
          );
        }
      } else {
        toast.success(`${variables.ids.length} product(s) updated`);
      }
      invalidate();
      setSelectedIds(new Set());
      setConfirmState(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p._id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkAction(
    action: "archive" | "restore" | "delete" | "permanent-delete" | "activate" | "deactivate"
  ) {
    const ids = Array.from(selectedIds);
    if (action === "delete" || action === "permanent-delete") {
      setConfirmState({ ids, action });
    } else {
      bulkActionMutation.mutate({ ids, action });
    }
  }

const exportHeaders = ["Sr No", "Name", "Code", "Category", "Rent", "Status"];

  async function fetchExportRows(): Promise<(string | number)[][]> {
    const full = await fetchProducts({ page: 1, search, category, status, sortBy, sortDir, all: true });
    return full.products.map((product, index) => [
      index + 1,
      product.name,
      product.sku,
      product.category?.name ?? "",
      product.rentalPricePerDay,
      product.isActive ? "Active" : "Inactive",
    ]);
  }

  async function withExportGuard(action: () => Promise<void>): Promise<void> {
    setIsExporting(true);
    try {
      await action();
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportExcel() {
    void withExportGuard(async () => {
      const rows = await fetchExportRows();
      await downloadExcel("products", "Product Inventory", exportHeaders, rows);
    });
  }

  function handleExportPdf() {
    void withExportGuard(async () => {
      const rows = await fetchExportRows();
      await downloadPdf("products", "Product Inventory", exportHeaders, rows);
    });
  }

  function handlePrint() {
    window.print();
  }

  const cardGrid = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <div key={product._id} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative aspect-square bg-secondary">
            {hasRealImage(product.images) ? (
              <button
                type="button"
                onClick={() => openPreview(product, 0)}
                className="absolute inset-0 h-full w-full cursor-zoom-in"
                aria-label={`Preview ${product.name} images`}
              >
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover"
                />
              </button>
            ) : (
              <Image
                src="/logo.png"
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-contain p-6 opacity-60"
              />
            )}
            <button
              type="button"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/80"
              aria-label={product.isFavorited ? "Remove from favorites" : "Add to favorites"}
              title={product.isFavorited ? "Remove from favorites" : "Add to favorites"}
              onClick={() =>
                favoriteMutation.mutate({ id: product._id, isFavorited: !product.isFavorited })
              }
            >
              <Star
                className={cn("h-3.5 w-3.5", product.isFavorited && "fill-accent text-accent")}
              />
            </button>
            {product.status === "sold" && (
              <div className="absolute left-2 top-2">
                <ProductStatusBadge status="sold" />
              </div>
            )}
          </div>
          <div className="p-3">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.sku}</p>
            <p className="mt-1 text-sm text-accent">
              &#8377;{product.rentalPricePerDay.toLocaleString("en-IN")}
              <span className="text-muted-foreground"> rent</span>
            </p>
            {(() => {
              const stock = totalStock(product.variants);
              const isLow = stock <= lowStockThreshold;
              return (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Stock:{" "}
                  <span className={isLow ? "font-medium text-destructive" : undefined}>
                    {stock}
                    {isLow && " ⚠"}
                  </span>
                </p>
              );
            })()}
            <div className="mt-2 flex gap-1">
              {canEdit && (
                <ButtonLink
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  href={`/admin/products/${product._id}`}
                >
                  Edit
                </ButtonLink>
              )}
              <Checkbox
                checked={selectedIds.has(product._id)}
                onCheckedChange={() => toggleSelectOne(product._id)}
                className="ml-1 self-center"
              />
            </div>
          </div>
        </div>
      ))}
      {products.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">
          {isFetching ? "Loading..." : "No products found."}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, designer..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All categories">
                {(value: string) =>
                  value === "all"
                    ? "All categories"
                    : (categories.find((cat) => cat._id === value)?.name ?? "All categories")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat._id} value={cat._id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? "active");
              setPage(1);
              setSelectedIds(new Set());
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue>
                {(value: string) =>
                  value === "active" ? "Active" : value === "archived" ? "Archived" : "Trash"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="trash">Trash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageSettings && (
            <ButtonLink
              variant="outline"
              size="icon"
              href="/admin/products/settings"
              aria-label="Inventory settings"
              title="Inventory settings"
            >
              <Settings2 className="h-4 w-4" />
            </ButtonLink>
          )}
          <ProductImportDialog />
          <ButtonLink href="/admin/products/new" className="rounded-md">
            New Product
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={view === "table" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setView("table")}
                  aria-label="Table view"
                />
              }
            >
              <List className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Table view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={view === "card" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setView("card")}
                  aria-label="Card view"
                />
              }
            >
              <Grid3x3 className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Card view</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === "table" && (
            <ColumnVisibilityMenu
              columns={COLUMN_DEFS}
              visible={columnVisibility}
              onChange={(key, value) => setColumnVisibility((prev) => ({ ...prev, [key]: value }))}
            />
          )}
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
      </div>

      {canEdit ? (
        <ProductsBulkToolbar
          count={selectedIds.size}
          status={status}
          onAction={handleBulkAction}
          onClear={() => setSelectedIds(new Set())}
        />
      ) : (
        selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {status === "trash" ? (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction("restore")}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => handleBulkAction("delete")}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Move to Trash
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                aria-label="Clear selection"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      )}

      <div className="lg:hidden">{cardGrid}</div>

      {view === "table" ? (
        <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
          <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-3">Sr No</th>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={products.length > 0 && selectedIds.size === products.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("name")}
                  >
                    Product <SortIcon field="name" sortBy={sortBy} sortDir={sortDir} />
                  </button>
                </th>
                {columnVisibility.category && <th className="px-4 py-3">Category</th>}
                {columnVisibility.price && (
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("rentalPricePerDay")}
                    >
                      Rent <SortIcon field="rentalPricePerDay" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                )}
                {columnVisibility.status && (
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("status")}
                    >
                      Status <SortIcon field="status" sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr key={product._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">
                    {(pagination.page - 1) * pagination.pageSize + index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(product._id)}
                      onCheckedChange={() => toggleSelectOne(product._id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                        {hasRealImage(product.images) ? (
                          <button
                            type="button"
                            onClick={() => openPreview(product, 0)}
                            className="absolute inset-0 h-full w-full cursor-zoom-in"
                            aria-label={`Preview ${product.name} images`}
                          >
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </button>
                        ) : (
                          <Image
                            src="/logo.png"
                            alt={product.name}
                            fill
                            sizes="40px"
                            className="object-contain p-1.5 opacity-60"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium">{product.name}</p>
                          {product.isFavorited && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </div>
                  </td>
                  {columnVisibility.category && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {product.category?.name ?? "—"}
                    </td>
                  )}
                  {columnVisibility.price && (
                    <td className="px-4 py-3">
                      {editingPriceId === product._id ? (
                        <Input
                          autoFocus
                          type="number"
                          value={priceDraft}
                          className="h-8 w-24"
                          onChange={(event) => setPriceDraft(event.target.value)}
                          onBlur={() => {
                            const value = Number(priceDraft);
                            if (!Number.isNaN(value) && value !== product.rentalPricePerDay) {
                              inlinePriceMutation.mutate({ id: product._id, rentalPricePerDay: value });
                            } else {
                              setEditingPriceId(null);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                            if (event.key === "Escape") setEditingPriceId(null);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="rounded px-1.5 py-0.5 hover:bg-secondary"
                          onClick={() => {
                            setEditingPriceId(product._id);
                            setPriceDraft(String(product.rentalPricePerDay));
                          }}
                        >
                          &#8377;{product.rentalPricePerDay.toLocaleString("en-IN")}
                        </button>
                      )}
                    </td>
                  )}
                  {columnVisibility.status && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={product.isActive ? "default" : "secondary"}
                          className="rounded-full"
                        >
                          {status === "trash" ? "Trashed" : status === "archived" ? "Archived" : product.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {product.status === "sold" && <ProductStatusBadge status="sold" />}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Favorite"
                              onClick={() =>
                                favoriteMutation.mutate({
                                  id: product._id,
                                  isFavorited: !product.isFavorited,
                                })
                              }
                            />
                          }
                        >
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              product.isFavorited && "fill-accent text-accent"
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {product.isFavorited ? "Remove from favorites" : "Add to favorites"}
                        </TooltipContent>
                      </Tooltip>
                      {status === "trash" ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Restore"
                                  onClick={() => restoreMutation.mutate(product._id)}
                                />
                              }
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>Restore from trash</TooltipContent>
                          </Tooltip>
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-destructive"
                                    aria-label="Delete permanently"
                                    onClick={() =>
                                      setConfirmState({ ids: [product._id], action: "permanent-delete" })
                                    }
                                  />
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>Delete permanently</TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      ) : (
                        <>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="View"
                                  onClick={() => setViewingId(product._id)}
                                />
                              }
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>
                          {canEdit && (
                            <ButtonLink
                              variant="ghost"
                              size="icon-sm"
                              href={`/admin/products/${product._id}`}
                              aria-label="Edit"
                              title="Edit product"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </ButtonLink>
                          )}
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Duplicate"
                                  onClick={() => duplicateMutation.mutate(product._id)}
                                />
                              }
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>Duplicate product</TooltipContent>
                          </Tooltip>
                          {product.archivedAt ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Restore"
                                    onClick={() => restoreMutation.mutate(product._id)}
                                  />
                                }
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>Unarchive product</TooltipContent>
                            </Tooltip>
                          ) : (
                            canEdit && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Archive"
                                      onClick={() => archiveMutation.mutate(product._id)}
                                    />
                                  }
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </TooltipTrigger>
                                <TooltipContent>Archive product</TooltipContent>
                              </Tooltip>
                            )
                          )}
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive"
                                  aria-label="Delete"
                                  onClick={() => trashMutation.mutate(product._id)}
                                />
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>Move to trash</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    {isFetching ? "Loading..." : "No products found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="hidden lg:block">{cardGrid}</div>
      )}

      <AdminPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        itemLabel="products"
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={
          confirmState?.action === "permanent-delete"
            ? "Permanently delete product(s)?"
            : "Move product(s) to trash?"
        }
        description={
          confirmState?.action === "permanent-delete"
            ? "This cannot be undone. The product and its history will be permanently removed."
            : "You can restore these products from the Trash view at any time."
        }
        confirmLabel={confirmState?.action === "permanent-delete" ? "Delete Permanently" : "Move to Trash"}
        variant="destructive"
        isLoading={bulkActionMutation.isPending || permanentDeleteMutation.isPending}
        onConfirm={() => {
          if (!confirmState) return;
          if (confirmState.ids.length === 1) {
            const id = confirmState.ids[0];
            if (confirmState.action === "permanent-delete") {
              permanentDeleteMutation.mutate(id, { onSuccess: () => setConfirmState(null) });
            } else {
              trashMutation.mutate(id, { onSuccess: () => setConfirmState(null) });
            }
          } else {
            bulkActionMutation.mutate({ ids: confirmState.ids, action: confirmState.action });
          }
        }}
      />

      <ProductDetailDrawer productId={viewingId} onClose={() => setViewingId(null)} />

      {previewProduct && (
        <ImagePreviewDialog
          images={previewProduct.images}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewIndex(-1);
              setPreviewProductId(null);
            }
          }}
          title={previewProduct.name}
          onSetCover={setCoverImage}
          isSettingCover={setCoverMutation.isPending}
        />
      )}
    </div>
  );
}
