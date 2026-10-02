"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  serviceOrderSchema,
  computeServiceOrderTotal,
  type ServiceOrderInput,
} from "@/lib/validations/service-order";

export interface ServiceOrderRow {
  _id: string;
  serviceType: "dry_clean" | "tailor";
  product: { _id: string; name: string; sku: string } | null;
  bookingBillNumberRef?: string;
  description: string;
  status: string;
  dryCleanCharge?: number;
  ironCharge?: number;
  stitchingCharge?: number;
  stitchingType?: string;
  otherCharge?: number;
  totalAmount: number;
  assignedTo?: string;
  sentDate: string;
  expectedReturnDate: string;
  notes?: string;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  color?: string;
  status?: string;
}

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  booked: "Booked",
  reserved: "Reserved",
  picked_up: "Picked up",
  under_dry_cleaning: "Already at dry cleaning",
  under_repair: "Already at tailor",
  damaged: "Damaged",
  returned: "Returned",
  sold: "Sold",
};

function productSublabel(product: ProductOption): string | undefined {
  const parts = [product.color, product.status ? PRODUCT_STATUS_LABELS[product.status] : undefined];
  const text = parts.filter(Boolean).join(" · ");
  return text || undefined;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

const EMPTY_VALUES: ServiceOrderInput = {
  serviceType: "dry_clean",
  product: "",
  booking: "",
  bookingBillNumberRef: "",
  description: "",
  dryCleanCharge: 0,
  ironCharge: 0,
  stitchingCharge: undefined,
  stitchingType: "",
  otherCharge: 0,
  assignedTo: "",
  sentDate: new Date().toISOString().slice(0, 10),
  expectedReturnDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

export interface ServiceOrderInitialValues {
  product: string;
  booking: string;
  description?: string;
}

export function ServiceOrderFormDialog({
  open,
  onOpenChange,
  products,
  editingOrder,
  initialValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  editingOrder: ServiceOrderRow | null;
  initialValues?: ServiceOrderInitialValues | null;
}) {
  const queryClient = useQueryClient();
  // Extra item rows beyond the first (which is the form's `product` field).
  // Only used when creating — an existing order is always one dress.
  const [extraProductIds, setExtraProductIds] = useState<string[]>([]);

  const form = useForm<ServiceOrderInput>({
    resolver: zodResolver(serviceOrderSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      setExtraProductIds([]);
      if (editingOrder) {
        form.reset({
          serviceType: editingOrder.serviceType,
          product: editingOrder.product?._id ?? "",
          bookingBillNumberRef: editingOrder.bookingBillNumberRef ?? "",
          description: editingOrder.description,
          dryCleanCharge: editingOrder.dryCleanCharge ?? 0,
          ironCharge: editingOrder.ironCharge ?? 0,
          stitchingCharge: editingOrder.stitchingCharge ?? 0,
          stitchingType: editingOrder.stitchingType ?? "",
          otherCharge: editingOrder.otherCharge ?? 0,
          assignedTo: editingOrder.assignedTo ?? "",
          sentDate: toDateInputValue(editingOrder.sentDate),
          expectedReturnDate: toDateInputValue(editingOrder.expectedReturnDate),
          notes: editingOrder.notes ?? "",
        });
      } else if (initialValues) {
        form.reset({
          ...EMPTY_VALUES,
          product: initialValues.product,
          booking: initialValues.booking,
          description: initialValues.description ?? EMPTY_VALUES.description,
        });
      } else {
        form.reset(EMPTY_VALUES);
      }
    }
  }, [open, editingOrder, initialValues, form]);

  const isProductLocked = !editingOrder && Boolean(initialValues);
  // Only relevant for a service order created directly from this page —
  // one launched from a booking's own detail page already carries a real
  // Booking link (see ServiceOrderInitialValues), so the free-text
  // reference would just be redundant there.
  const showBookingBillNumberRef = Boolean(editingOrder) || !initialValues;

  const productValue = form.watch("product");
  const serviceTypeValue = form.watch("serviceType");
  const dryCleanCharge = form.watch("dryCleanCharge");
  const ironCharge = form.watch("ironCharge");
  const stitchingCharge = form.watch("stitchingCharge");
  const otherCharge = form.watch("otherCharge");
  const canAddMultiple = !editingOrder && !isProductLocked;
  const selectedIds = [productValue, ...extraProductIds].filter(Boolean);
  const itemCount = canAddMultiple ? Math.max(1, selectedIds.length) : 1;
  const chargeSuffix = itemCount > 1 ? " — per dress" : "";

  // Same picker as the booking form: searchable, with color/status shown,
  // and a dress already picked in another row can't be picked twice.
  function productOptions(currentValue: string) {
    return products.map((product) => ({
      value: product._id,
      label: `${product.name} (${product.sku})`,
      sublabel: productSublabel(product),
      disabled: product._id !== currentValue && selectedIds.includes(product._id),
    }));
  }

  const total = computeServiceOrderTotal({
    serviceType: serviceTypeValue,
    dryCleanCharge,
    ironCharge,
    stitchingCharge,
    otherCharge,
  });

  const mutation = useMutation({
    mutationFn: async (values: ServiceOrderInput) => {
      const url = editingOrder
        ? `/api/admin/service-orders/${editingOrder._id}`
        : "/api/admin/service-orders";
      const payload =
        canAddMultiple && extraProductIds.some(Boolean)
          ? { ...values, additionalProducts: extraProductIds.filter(Boolean) }
          : values;
      const res = await fetch(url, {
        method: editingOrder ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.order;
    },
    onSuccess: () => {
      toast.success(
        editingOrder
          ? "Service order updated"
          : itemCount > 1
            ? `${itemCount} service orders created`
            : "Service order created"
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "service-orders"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingOrder ? "Edit Service Order" : "New Service Order"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="serviceType"
                render={() => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select
                      value={serviceTypeValue}
                      onValueChange={(value) =>
                        form.setValue("serviceType", value as "dry_clean" | "tailor")
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: "dry_clean" | "tailor") =>
                              value === "dry_clean" ? "Dry Clean" : "Tailor / Alteration"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dry_clean">Dry Clean</SelectItem>
                        <SelectItem value="tailor">Tailor / Alteration</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!canAddMultiple && (
                <FormField
                  control={form.control}
                  name="product"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          disabled={isProductLocked}
                          placeholder="Select item"
                          searchPlaceholder="Search by name, code, or color..."
                          emptyText="No items found."
                          options={productOptions(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {canAddMultiple && (
              <section className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Items</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExtraProductIds((ids) => [...ids, ""])}
                  >
                    <Plus className="h-4 w-4" /> Add Item
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="product"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex gap-2">
                        <FormControl>
                          <SearchableSelect
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            placeholder="Select item"
                            searchPlaceholder="Search by name, code, or color..."
                            emptyText="No items found."
                            options={productOptions(field.value)}
                          />
                        </FormControl>
                        {extraProductIds.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove item"
                            onClick={() => {
                              // Promote the next row into the first slot.
                              const [next, ...rest] = extraProductIds;
                              form.setValue("product", next ?? "");
                              setExtraProductIds(rest);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {extraProductIds.map((productId, index) => (
                  <div key={index} className="flex gap-2">
                    <SearchableSelect
                      value={productId}
                      onChange={(value) =>
                        setExtraProductIds((ids) => ids.map((id, i) => (i === index ? value : id)))
                      }
                      placeholder="Select item"
                      searchPlaceholder="Search by name, code, or color..."
                      emptyText="No items found."
                      options={productOptions(productId)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove item"
                      onClick={() => setExtraProductIds((ids) => ids.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {itemCount > 1 && (
                  <p className="text-xs text-muted-foreground">
                    One service order is created per dress, each with the details and charges
                    below.
                  </p>
                )}
              </section>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Hem shortening, stain removal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showBookingBillNumberRef && (
              <FormField
                control={form.control}
                name="bookingBillNumberRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking Bill Number (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 00881 — the related booking's bill no." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {serviceTypeValue === "tailor" && (
              <FormField
                control={form.control}
                name="stitchingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stitching Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Blouse, Lehenga, Alteration" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {serviceTypeValue === "dry_clean" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dryCleanCharge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dry Clean Charge (₹){chargeSuffix}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ? field.value : ""}
                          onChange={(event) =>
                            field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ironCharge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Iron Charge (₹){chargeSuffix}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ? field.value : ""}
                          onChange={(event) =>
                            field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <FormField
                control={form.control}
                name="stitchingCharge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stitching Charge (₹){chargeSuffix}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.value ? field.value : ""}
                        onChange={(event) =>
                          field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="otherCharge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other Charge (₹){chargeSuffix}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.value ? field.value : ""}
                        onChange={(event) =>
                          field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Total Amount</FormLabel>
                <div className="flex h-9 items-center rounded-md border border-border bg-secondary/40 px-3 text-sm font-medium">
                  ₹{(total * itemCount).toLocaleString("en-IN")}
                  {itemCount > 1 && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({itemCount} × ₹{total.toLocaleString("en-IN")})
                    </span>
                  )}
                </div>
              </FormItem>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sent Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedReturnDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Return</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned To (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. In-house tailor, ABC Dry Cleaners" {...field} />
                  </FormControl>
                  <FormMessage />
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
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingOrder
                  ? "Save Changes"
                  : itemCount > 1
                    ? `Create ${itemCount} Orders`
                    : "Create Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
