"use client";

import { useEffect, useMemo, useState } from "react";
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
import { saleSchema, type SaleInput } from "@/lib/validations/sale";
import type { CustomerCreateInput } from "@/lib/validations/customer";
import { customerContact } from "@/lib/utils";

export interface SaleRow {
  _id: string;
  billNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  product: { _id: string; name: string; sku: string } | null;
  details?: string;
  totalAmount: number;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
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

const EMPTY_VALUES: SaleInput = {
  saleDate: new Date().toISOString().slice(0, 10),
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  product: "",
  details: "",
  totalAmount: 0,
};

export function SaleFormDialog({
  open,
  onOpenChange,
  products,
  customers,
  editingSale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  customers: CustomerOption[];
  editingSale: SaleRow | null;
}) {
  const queryClient = useQueryClient();
  const [customerList, setCustomerList] = useState<CustomerOption[]>(customers);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  const form = useForm<SaleInput>({
    resolver: zodResolver(saleSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      if (editingSale) {
        form.reset({
          saleDate: toDateInputValue(editingSale.saleDate),
          customerName: editingSale.customerName,
          customerPhone: editingSale.customerPhone,
          customerAddress: editingSale.customerAddress,
          product: editingSale.product?._id ?? "",
          details: editingSale.details ?? "",
          totalAmount: editingSale.totalAmount,
        });
      } else {
        form.reset(EMPTY_VALUES);
      }
    }
  }, [open, editingSale, form]);

  // The picker only offers unsold dresses. When editing a sale whose dress
  // has since been marked sold (by this very sale, most likely), it would
  // otherwise vanish from the list — fold it back in so the field still
  // shows the correct name/SKU instead of going blank.
  const availableProducts = useMemo(() => {
    if (!editingSale?.product || products.some((p) => p._id === editingSale.product?._id)) {
      return products;
    }
    return [...products, editingSale.product];
  }, [products, editingSale]);

  const productValue = form.watch("product");
  const selectedProduct = availableProducts.find((p) => p._id === productValue);

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
        // Walk-in sales usually don't come with an email — generate a
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

  const mutation = useMutation({
    mutationFn: async (values: SaleInput) => {
      const url = editingSale ? `/api/admin/sales/${editingSale._id}` : "/api/admin/sales";
      const res = await fetch(url, {
        method: editingSale ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.sale;
    },
    onSuccess: () => {
      toast.success(editingSale ? "Sale updated" : "Sale created");
      queryClient.invalidateQueries({ queryKey: ["admin", "sales"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingSale ? "Edit Sale" : "New Sale"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
          >
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
              name="product"
              render={() => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select
                    value={productValue}
                    onValueChange={(value) => form.setValue("product", value ?? "")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
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
                      {availableProducts.map((product) => (
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

            <FormField
              control={form.control}
              name="details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="saleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            </div>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingSale ? "Save Changes" : "Create Sale"}
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
