"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Grid3x3, List, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { categorySchema, type CategoryInput } from "@/lib/validations/category";

interface CategoryRow extends CategoryInput {
  _id: string;
}

async function fetchCategories(): Promise<CategoryRow[]> {
  const res = await fetch("/api/admin/categories");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.categories;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoriesClient({ initialCategories }: { initialCategories: CategoryRow[] }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [view, setView] = useState<"table" | "card">("table");

  const { data: categories = initialCategories } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: fetchCategories,
    initialData: initialCategories,
  });

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
    },
  });

  function openCreateDialog() {
    setEditing(null);
    form.reset({
      name: "",
      slug: "",
      description: "",
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
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
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
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

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
          </div>
          <div className="p-3">
            <p className="truncate text-sm font-medium">{category.name}</p>
            <p className="truncate text-xs text-muted-foreground">{category.slug}</p>
            <div className="mt-2 flex justify-end gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(category)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Delete "${category.name}"? This cannot be undone.`)) {
                    deleteMutation.mutate(category._id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      {categories.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">
          No categories yet. Create your first one.
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{categories.length} categories</p>
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
        <Button onClick={openCreateDialog} className="rounded-md">
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      <div className="lg:hidden">{cardGrid}</div>

      {view === "card" ? (
        <div className="hidden lg:block">{cardGrid}</div>
      ) : (
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
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
                    <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(category)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete "${category.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(category._id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No categories yet. Create your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

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
    </div>
  );
}
