"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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
  customisationOrderSchema,
  computeCustomisationDue,
  type CustomisationOrderInput,
} from "@/lib/validations/customisation-order";
import type { CustomisationMeasurements } from "@/models/CustomisationOrder";
import type { CustomerCreateInput } from "@/lib/validations/customer";
import { MEASUREMENT_FIELD_DEFS } from "@/lib/config/measurement-fields";
import { customerContact } from "@/lib/utils";

export interface CustomisationOrderRow {
  _id: string;
  billNumber: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  stitchingType: string;
  detail: string;
  measurements?: CustomisationMeasurements;
  totalAmount: number;
  advancePayment: number;
  dueAmount: number;
  status: string;
  notes?: string;
}

export interface CustomerOption {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

const RELATION_OPTIONS = ["S/O", "D/O", "W/O"] as const;

const quickCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid mobile number"),
  relation: z.enum(RELATION_OPTIONS),
  relationName: z.string().trim().optional().or(z.literal("")),
  addressLine1: z.string().trim().optional().or(z.literal("")),
});

type QuickCustomerInput = z.infer<typeof quickCustomerSchema>;

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

const MEASUREMENT_FIELDS: { key: keyof CustomisationMeasurements; label: string }[] =
  MEASUREMENT_FIELD_DEFS;

const EMPTY_VALUES: CustomisationOrderInput = {
  orderDate: new Date().toISOString().slice(0, 10),
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  stitchingType: "",
  detail: "",
  measurements: {},
  totalAmount: 0,
  advancePayment: 0,
  notes: "",
};

export function CustomisationFormDialog({
  open,
  onOpenChange,
  customers,
  editingOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  editingOrder: CustomisationOrderRow | null;
}) {
  const queryClient = useQueryClient();
  const [customerList, setCustomerList] = useState<CustomerOption[]>(customers);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  const form = useForm<CustomisationOrderInput>({
    resolver: zodResolver(customisationOrderSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      if (editingOrder) {
        form.reset({
          orderDate: toDateInputValue(editingOrder.orderDate),
          customerName: editingOrder.customerName,
          customerPhone: editingOrder.customerPhone,
          customerAddress: editingOrder.customerAddress,
          stitchingType: editingOrder.stitchingType,
          detail: editingOrder.detail,
          measurements: editingOrder.measurements ?? {},
          totalAmount: editingOrder.totalAmount,
          advancePayment: editingOrder.advancePayment,
          notes: editingOrder.notes ?? "",
        });
      } else {
        form.reset(EMPTY_VALUES);
      }
    }
  }, [open, editingOrder, form]);

  function applyCustomer(customer: CustomerOption) {
    form.setValue("customerName", customer.name);
    if (customer.phone) form.setValue("customerPhone", customer.phone);
    if (customer.address) form.setValue("customerAddress", customer.address);
  }

  const quickCustomerForm = useForm<QuickCustomerInput>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: { name: "", phone: "", relation: "S/O", relationName: "", addressLine1: "" },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (values: QuickCustomerInput) => {
      const digits = values.phone.replace(/[^0-9]/g, "") || "customer";
      const payload: CustomerCreateInput = {
        name: values.name,
        // Walk-in orders usually don't come with an email — generate a
        // unique placeholder so account creation isn't blocked on one.
        email: `${digits}.${Date.now()}@walkin.vchuki.local`,
        phone: values.phone,
        fatherName: values.relationName ? `${values.relation} ${values.relationName}` : "",
        addressLine1: values.addressLine1 || "",
        addressCity: "",
        addressState: "",
        addressPostalCode: "",
      };
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.customer as { _id: string; name: string; email: string };
    },
    onSuccess: (customer, values) => {
      toast.success("Customer created");
      const option: CustomerOption = {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: values.phone,
        address: values.addressLine1 || undefined,
      };
      setCustomerList((prev) => [...prev, option]);
      applyCustomer(option);
      quickCustomerForm.reset();
      setNewCustomerOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalAmount = form.watch("totalAmount");
  const advancePayment = form.watch("advancePayment");
  const dueAmount = computeCustomisationDue({
    totalAmount: totalAmount || 0,
    advancePayment: advancePayment || 0,
  });

  const mutation = useMutation({
    mutationFn: async (values: CustomisationOrderInput) => {
      const url = editingOrder
        ? `/api/admin/customisation-orders/${editingOrder._id}`
        : "/api/admin/customisation-orders";
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
      toast.success(editingOrder ? "Order updated" : "Order created");
      queryClient.invalidateQueries({ queryKey: ["admin", "customisation-orders"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingOrder ? "Edit Customisation Order" : "New Customisation Order"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stitchingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stitching Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Blouse, Lehenga" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormItem>
              <FormLabel>Customer</FormLabel>
              <div className="flex gap-2">
                <SearchableSelect
                  value=""
                  onChange={(value) => {
                    const customer = customerList.find((c) => c._id === value);
                    if (customer) applyCustomer(customer);
                  }}
                  placeholder="Search customers to fill in the fields below"
                  searchPlaceholder="Search by name or email..."
                  emptyText="No customers found."
                  options={customerList.map((customer) => ({
                    value: customer._id,
                    label: customer.name,
                    sublabel: customerContact(customer),
                  }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setNewCustomerOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  New
                </Button>
              </div>
            </FormItem>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile No.</FormLabel>
                    <FormControl>
                      <PhoneInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="customerAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="detail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detail</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <p className="text-sm font-medium">Measurements (inches)</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {MEASUREMENT_FIELDS.map(({ key, label }) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={`measurements.${key}` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{label}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            value={(field.value as number | undefined) ?? ""}
                            onChange={(event) =>
                              field.onChange(
                                event.target.value === "" ? undefined : Number(event.target.value)
                              )
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormField
                control={form.control}
                name="measurements.other"
                render={({ field }) => (
                  <FormItem className="mt-3">
                    <FormLabel className="text-xs">Other Measurement Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Any other measurement details" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount (₹)</FormLabel>
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
                name="advancePayment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Advance Payment (₹)</FormLabel>
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
                <FormLabel>Due Amount</FormLabel>
                <div className="flex h-9 items-center rounded-md border border-border bg-secondary/40 px-3 text-sm font-medium">
                  ₹{dueAmount.toLocaleString("en-IN")}
                </div>
              </FormItem>
            </div>

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

    <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <Form {...quickCustomerForm}>
          <form
            onSubmit={quickCustomerForm.handleSubmit((values) => createCustomerMutation.mutate(values))}
            className="space-y-4"
          >
            <FormField
              control={quickCustomerForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Customer name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={quickCustomerForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile</FormLabel>
                  <FormControl>
                    <PhoneInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <FormField
                control={quickCustomerForm.control}
                name="relation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relation</FormLabel>
                    <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "S/O")}>
                      <FormControl>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RELATION_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={quickCustomerForm.control}
                name="relationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Husband's / Father's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={quickCustomerForm.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createCustomerMutation.isPending}>
                {createCustomerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Customer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
