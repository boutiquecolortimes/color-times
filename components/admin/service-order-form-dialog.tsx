"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

  const form = useForm<ServiceOrderInput>({
    resolver: zodResolver(serviceOrderSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
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
  const selectedProduct = products.find((p) => p._id === productValue);

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
      const res = await fetch(url, {
        method: editingOrder ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.order;
    },
    onSuccess: () => {
      toast.success(editingOrder ? "Service order updated" : "Service order created");
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

              <FormField
                control={form.control}
                name="product"
                render={() => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select
                      value={productValue}
                      onValueChange={(value) => form.setValue("product", value ?? "")}
                      disabled={isProductLocked}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" disabled={isProductLocked}>
                          <SelectValue placeholder="Select a product">
                            {() =>
                              selectedProduct
                                ? `${selectedProduct.name} (${selectedProduct.sku})`
                                : "Select a product"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
            </div>

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
                      <FormLabel>Dry Clean Charge (₹)</FormLabel>
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
                      <FormLabel>Iron Charge (₹)</FormLabel>
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
                    <FormLabel>Stitching Charge (₹)</FormLabel>
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
                    <FormLabel>Other Charge (₹)</FormLabel>
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
                  ₹{total.toLocaleString("en-IN")}
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
                {editingOrder ? "Save Changes" : "Create Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
