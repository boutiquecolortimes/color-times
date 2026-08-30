"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  purchaseParcelSchema,
  type PurchaseParcelInput,
  type PurchaseParcelLineInput,
} from "@/lib/validations/purchase";
import { cn } from "@/lib/utils";

interface CategoryOption {
  _id: string;
  name: string;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  variants: { size: string; quantityInStock: number }[];
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  pending: "Pending",
  partial: "Partially Paid",
};

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

// New lines default to "Create new dress" — a dealer bill is almost always
// fresh stock coming in, and this way an admin can add line after line just
// by typing names, no dropdown required. "Restock" is a deliberate switch
// for the less common case of topping up something already in the catalog.
function emptyLine(): PurchaseParcelLineInput {
  return {
    mode: "new",
    product: "",
    name: "",
    category: "",
    color: "",
    fabric: "",
    sku: "",
    rentalPricePerDay: undefined,
    variantSize: "",
    quantity: 1,
    unitCost: 0,
  };
}

export function PurchaseParcelForm({
  categories,
  products,
}: {
  categories: CategoryOption[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const form = useForm<PurchaseParcelInput>({
    resolver: zodResolver(purchaseParcelSchema),
    defaultValues: {
      billNumber: "",
      vendorName: "",
      vendorContact: "",
      purchaseDate: new Date().toISOString().slice(0, 10),
      paymentStatus: "paid",
      amountPaid: undefined,
      notes: "",
      items: [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = form.watch("items");

  const billTotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    0
  );

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (values: PurchaseParcelInput) => {
      const res = await fetch("/api/admin/purchases/parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { billNumber: string; purchaseCount: number; productsCreated: number };
    },
    onSuccess: (data) => {
      toast.success(
        `Bill ${data.billNumber} saved — ${data.purchaseCount} item${data.purchaseCount === 1 ? "" : "s"} recorded` +
          (data.productsCreated
            ? `, ${data.productsCreated} new dress${data.productsCreated === 1 ? "" : "es"} created (finish them from Products)`
            : "")
      );
      router.push("/admin/purchases");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Bill Details</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="billNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. INV-2451" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vendorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dealer Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vendorContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dealer Contact (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Status</FormLabel>
                  <Select value={field.value ?? "paid"} onValueChange={(value) => field.onChange(value ?? "paid")}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>{(value: string) => PAYMENT_STATUS_LABELS[value] ?? value}</SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
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
              name="amountPaid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount Paid (₹, optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(event.target.value === "" ? undefined : Math.max(0, Number(event.target.value)))
                      }
                      placeholder={`Defaults to ${formatCurrency(billTotal)} if Paid`}
                    />
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
              <FormItem className="mt-3">
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Products <span className="text-muted-foreground">({fields.length})</span>
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
              <Plus className="h-3.5 w-3.5" />
              Add Product
            </Button>
          </div>

          {fields.map((field, index) => {
            const mode = watchedItems[index]?.mode ?? "new";
            const isExpanded = expanded.has(field.id);
            const lineTotal =
              (Number(watchedItems[index]?.quantity) || 0) * (Number(watchedItems[index]?.unitCost) || 0);

            return (
              <div key={field.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                    <div className="inline-flex rounded-md border border-border bg-secondary/40 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => form.setValue(`items.${index}.mode`, "new")}
                        className={cn(
                          "rounded px-2 py-1 font-medium transition-colors",
                          mode === "new" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        New Dress
                      </button>
                      <button
                        type="button"
                        onClick={() => form.setValue(`items.${index}.mode`, "existing")}
                        className={cn(
                          "rounded px-2 py-1 font-medium transition-colors",
                          mode === "existing"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Restock
                      </button>
                    </div>
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {mode === "existing" ? (
                  <div className="mt-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.product`}
                      render={({ field: productField }) => (
                        <FormItem>
                          <FormLabel>Dress</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              className="h-8 w-full"
                              value={productField.value || ""}
                              onChange={productField.onChange}
                              placeholder="Search by name or code..."
                              searchPlaceholder="Search by name or code..."
                              emptyText="No dresses found."
                              options={products.map((product) => ({
                                value: product._id,
                                label: product.name,
                                sublabel: product.sku,
                              }))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field: nameField }) => (
                        <FormItem>
                          <FormLabel>Dress Name</FormLabel>
                          <FormControl>
                            <Input {...nameField} placeholder="e.g. Red Silk Saree" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.category`}
                      render={({ field: categoryField }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              className="h-8 w-full"
                              value={categoryField.value || ""}
                              onChange={categoryField.onChange}
                              placeholder="Search category..."
                              searchPlaceholder="Search category..."
                              emptyText="No categories found."
                              options={categories.map((category) => ({
                                value: category._id,
                                label: category.name,
                              }))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.sku`}
                      render={({ field: skuField }) => (
                        <FormItem>
                          <FormLabel>Code (optional)</FormLabel>
                          <FormControl>
                            <Input {...skuField} placeholder="Auto-generated" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name={`items.${index}.variantSize`}
                    render={({ field: sizeField }) => (
                      <FormItem>
                        <FormLabel>Size</FormLabel>
                        <FormControl>
                          <Input {...sizeField} placeholder="M, 38, Custom" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field: qtyField }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            value={qtyField.value === 0 ? "" : qtyField.value}
                            onChange={(event) => qtyField.onChange(Math.max(1, Number(event.target.value) || 1))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.unitCost`}
                    render={({ field: costField }) => (
                      <FormItem>
                        <FormLabel>Unit Cost (₹)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={costField.value === 0 ? "" : costField.value}
                            onChange={(event) => costField.onChange(Math.max(0, Number(event.target.value) || 0))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {mode === "new" && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(field.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                      {isExpanded ? "Hide" : "Add"} color, fabric &amp; rental price
                    </button>
                    {isExpanded && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.color`}
                          render={({ field: colorField }) => (
                            <FormItem>
                              <FormLabel>Color (optional)</FormLabel>
                              <FormControl>
                                <Input {...colorField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.fabric`}
                          render={({ field: fabricField }) => (
                            <FormItem>
                              <FormLabel>Fabric (optional)</FormLabel>
                              <FormControl>
                                <Input {...fabricField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.rentalPricePerDay`}
                          render={({ field: rentField }) => (
                            <FormItem>
                              <FormLabel>Rental Price / Day (₹, optional)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  value={rentField.value ?? ""}
                                  onChange={(event) =>
                                    rentField.onChange(
                                      event.target.value === "" ? undefined : Math.max(0, Number(event.target.value))
                                    )
                                  }
                                  placeholder="Finish later on the product page"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                  Line total: <span className="font-medium text-foreground">{formatCurrency(lineTotal)}</span>
                </p>
              </div>
            );
          })}
        </div>

        {/*
          The admin shell's mobile bottom nav is a fixed bar (see
          bottom-nav.tsx, hidden at lg:) that floats over the page's own
          scroll area rather than reserving space for itself — so a bar
          simply stuck to bottom-0 here would rest right behind it, its
          buttons unreachable under the nav. Clearing by the nav's height
          (+ safe-area inset) keeps this bar sitting just above it on
          mobile; lg:bottom-0 drops it flush once the nav is gone.
        */}
        <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5 shadow-sm lg:bottom-0">
          <p className="text-sm">
            Bill total: <span className="font-semibold">{formatCurrency(billTotal)}</span>{" "}
            <span className="text-muted-foreground">
              · {watchedItems.length} line{watchedItems.length === 1 ? "" : "s"}
            </span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/admin/purchases")}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Purchase
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
