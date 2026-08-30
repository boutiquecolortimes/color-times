"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
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

const NO_PRODUCT_VALUE = "__none__";
const NO_CATEGORY_VALUE = "__none__";

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function emptyLine(): PurchaseParcelLineInput {
  return {
    mode: "existing",
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
      <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-medium">Bill Details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One dealer bill, however many dresses it covers.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <FormLabel>Amount Paid So Far (₹, optional)</FormLabel>
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
              <FormItem className="mt-4">
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Products in this Bill</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
              <Plus className="h-3.5 w-3.5" />
              Add Product Line
            </Button>
          </div>

          {fields.map((field, index) => {
            const mode = watchedItems[index]?.mode ?? "existing";
            const lineTotal =
              (Number(watchedItems[index]?.quantity) || 0) * (Number(watchedItems[index]?.unitCost) || 0);

            return (
              <div key={field.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Line {index + 1}</span>
                    <Select
                      value={mode}
                      onValueChange={(value) =>
                        form.setValue(`items.${index}.mode`, (value ?? "existing") as "existing" | "new")
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue>
                          {() => (mode === "existing" ? "Restock existing dress" : "Create new dress")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="existing">Restock existing dress</SelectItem>
                        <SelectItem value="new">Create new dress</SelectItem>
                      </SelectContent>
                    </Select>
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

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {mode === "existing" ? (
                    <FormField
                      control={form.control}
                      name={`items.${index}.product`}
                      render={({ field: productField }) => (
                        <FormItem className="lg:col-span-2">
                          <FormLabel>Dress</FormLabel>
                          <Select
                            value={productField.value || NO_PRODUCT_VALUE}
                            onValueChange={(value) =>
                              productField.onChange(value === NO_PRODUCT_VALUE ? "" : value)
                            }
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue>
                                  {() => products.find((p) => p._id === productField.value)?.name ?? "Select a dress"}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NO_PRODUCT_VALUE} disabled>
                                Select a dress
                              </SelectItem>
                              {products.map((product) => (
                                <SelectItem key={product._id} value={product._id}>
                                  {product.name} ({product.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <>
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
                            <Select
                              value={categoryField.value || NO_CATEGORY_VALUE}
                              onValueChange={(value) =>
                                categoryField.onChange(value === NO_CATEGORY_VALUE ? "" : value)
                              }
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue>
                                    {() =>
                                      categories.find((c) => c._id === categoryField.value)?.name ?? "Select category"
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NO_CATEGORY_VALUE} disabled>
                                  Select category
                                </SelectItem>
                                {categories.map((category) => (
                                  <SelectItem key={category._id} value={category._id}>
                                    {category.name}
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
                        name={`items.${index}.sku`}
                        render={({ field: skuField }) => (
                          <FormItem>
                            <FormLabel>Code / SKU (optional)</FormLabel>
                            <FormControl>
                              <Input {...skuField} placeholder="Auto-generated if left blank" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name={`items.${index}.variantSize`}
                    render={({ field: sizeField }) => (
                      <FormItem>
                        <FormLabel>Size</FormLabel>
                        <FormControl>
                          <Input {...sizeField} placeholder="e.g. M, 38, Custom" />
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

                <p className="mt-3 text-sm text-muted-foreground">
                  Line total: <span className="font-medium text-foreground">{formatCurrency(lineTotal)}</span>
                </p>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm">
            Bill total: <span className="text-base font-semibold">{formatCurrency(billTotal)}</span> across{" "}
            {watchedItems.length} line{watchedItems.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/purchases")}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Purchase
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
