"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { invoiceSchema, computeInvoiceTotals, type InvoiceInput } from "@/lib/validations/invoice";

interface CustomerOption {
  _id: string;
  name: string;
  email: string;
}

interface BookingOption {
  _id: string;
  bookingNumber: string;
  rentalFee: number;
  securityDeposit: number;
  customerName: string;
  productName: string;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function FromBookingTab({ bookings }: { bookings: BookingOption[] }) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string>("");

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/admin/invoices/from-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.invoice;
    },
    onSuccess: (invoice) => {
      toast.success("Invoice created");
      router.push(`/admin/invoices/${invoice._id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selected = bookings.find((b) => b._id === bookingId);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <label className="text-sm font-medium">Booking</label>
        <Select value={bookingId} onValueChange={(value) => setBookingId(value ?? "")}>
          <SelectTrigger className="mt-2 w-full">
            <SelectValue placeholder="Select a booking">
              {() =>
                selected
                  ? `${selected.bookingNumber} — ${selected.customerName} (${selected.productName})`
                  : "Select a booking"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {bookings.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No eligible bookings found.
              </div>
            )}
            {bookings.map((booking) => (
              <SelectItem key={booking._id} value={booking._id}>
                {booking.bookingNumber} — {booking.customerName} ({booking.productName})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Only confirmed, in-use, or returned bookings are shown.
        </p>
      </div>

      {selected && (
        <div className="grid grid-cols-2 gap-3 rounded-md bg-secondary/40 p-4 text-sm">
          <p>
            Rental Fee: <span className="font-medium">{formatCurrency(selected.rentalFee)}</span>
          </p>
          <p>
            Security Deposit:{" "}
            <span className="font-medium">{formatCurrency(selected.securityDeposit)}</span>
          </p>
          <p className="col-span-2">
            Total:{" "}
            <span className="font-medium">
              {formatCurrency(selected.rentalFee + selected.securityDeposit)}
            </span>
          </p>
        </div>
      )}

      <Button
        disabled={!bookingId || mutation.isPending}
        onClick={() => mutation.mutate(bookingId)}
      >
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Generate Invoice
      </Button>
    </div>
  );
}

function ManualTab({
  customers,
  bookings,
}: {
  customers: CustomerOption[];
  bookings: BookingOption[];
}) {
  const router = useRouter();
  const form = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer: "",
      booking: null,
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
      discountAmount: 0,
      taxRate: 0,
      securityDeposit: 0,
      dueDate: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
  const lineItems = form.watch("lineItems");
  const discountAmount = form.watch("discountAmount") || 0;
  const taxRate = form.watch("taxRate") || 0;
  const securityDeposit = form.watch("securityDeposit") || 0;
  const customerValue = form.watch("customer");
  const bookingValue = form.watch("booking");

  const totals = computeInvoiceTotals({
    lineItems: lineItems.map((item) => ({
      description: item.description ?? "",
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
    })),
    discountAmount,
    taxRate,
    securityDeposit,
  });

  const mutation = useMutation({
    mutationFn: async (values: InvoiceInput) => {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.invoice;
    },
    onSuccess: (invoice) => {
      toast.success("Invoice created");
      router.push(`/admin/invoices/${invoice._id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-6"
      >
        <section className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="customer"
            render={() => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <Select
                  value={customerValue}
                  onValueChange={(value) => form.setValue("customer", value ?? "")}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select customer">
                        {(value: string) => {
                          const customer = customers.find((c) => c._id === value);
                          return customer ? `${customer.name} (${customer.email})` : "Select customer";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer._id} value={customer._id}>
                        {customer.name} ({customer.email})
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
            name="booking"
            render={() => (
              <FormItem>
                <FormLabel>Linked Booking (optional)</FormLabel>
                <Select
                  value={bookingValue ?? "none"}
                  onValueChange={(value) =>
                    form.setValue("booking", value === "none" ? null : value)
                  }
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None">
                        {(value: string) => {
                          if (value === "none" || !value) return "None";
                          const booking = bookings.find((b) => b._id === value);
                          return booking ? booking.bookingNumber : "None";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {bookings.map((booking) => (
                      <SelectItem key={booking._id} value={booking._id}>
                        {booking.bookingNumber} — {booking.customerName}
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
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg">Line Items</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
            >
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {fields.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-6">
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Description" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Qty"
                            step="1"
                            value={field.value ? field.value : ""}
                            onChange={(event) =>
                              field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unit Price"
                            step="0.01"
                            value={field.value ? field.value : ""}
                            onChange={(event) =>
                              field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-1 flex justify-end pt-2">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {form.formState.errors.lineItems?.message && (
            <p className="mt-2 text-sm text-destructive">
              {form.formState.errors.lineItems.message}
            </p>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-6 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="discountAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount (₹)</FormLabel>
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
            name="taxRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Rate (%)</FormLabel>
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
            name="securityDeposit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Security Deposit (₹)</FormLabel>
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
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
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
        </section>

        <section className="rounded-lg border border-border bg-secondary/40 p-6">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <p>
              Subtotal: <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </p>
            <p>
              Discount:{" "}
              <span className="font-medium">-{formatCurrency(totals.discountAmount)}</span>
            </p>
            <p>
              Tax: <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
            </p>
            <p>
              Deposit: <span className="font-medium">{formatCurrency(securityDeposit)}</span>
            </p>
          </div>
          <p className="mt-3 font-heading text-xl">Total: {formatCurrency(totals.total)}</p>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Invoice
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function InvoiceForm({
  customers,
  bookings,
}: {
  customers: CustomerOption[];
  bookings: BookingOption[];
}) {
  return (
    <Tabs defaultValue="from-booking">
      <TabsList>
        <TabsTrigger value="from-booking">From Booking</TabsTrigger>
        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
      </TabsList>
      <TabsContent value="from-booking" className="mt-4">
        <FromBookingTab bookings={bookings} />
      </TabsContent>
      <TabsContent value="manual" className="mt-4">
        <ManualTab customers={customers} bookings={bookings} />
      </TabsContent>
    </Tabs>
  );
}
