"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
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
import { bookingCreateSchema, type BookingCreateInput } from "@/lib/validations/booking";
import type { CustomerCreateInput } from "@/lib/validations/customer";
import { daysBetween } from "@/lib/utils";

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Just the fields this business actually measures for a booking — the full
// 11-field set (bust, waist, hip, etc.) lives in lib/config/measurement-fields
// and stays as-is for the Customisation flow, which still needs it.
const BOOKING_MEASUREMENT_FIELDS = [
  { key: "upperChest", label: "Upper Chest (UC)" },
  { key: "lowerChest", label: "Lower Chest (LC)" },
  { key: "sleeveLength", label: "Sleeve Length (SL)" },
  { key: "armhole", label: "Armhole (AH)" },
] as const;

interface CustomerOption {
  _id: string;
  name: string;
  email: string;
}

const RELATION_OPTIONS = ["S/O", "W/O"] as const;

// Quick add from the booking form only asks for what a walk-in/phone booking
// actually has on hand — name, mobile, relation + name, and address. No
// email: the full customer record still needs one (login identity), so we
// generate a unique placeholder behind the scenes and it can be filled in
// properly later from the customer's profile.
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

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  color: string;
  rentalPricePerDay: number;
  securityDeposit: number;
  variants: { size: string; quantityInStock: number }[];
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

async function fetchAvailability(
  productId: string,
  from: string,
  to: string
): Promise<{ available: boolean; conflicts: { bookingNumber: string }[] }> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/admin/products/${productId}/availability?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Bulk check so the dress dropdown can flag already-booked items upfront,
// before the user picks one — not just warn after the fact.
async function fetchBookedProductIds(from: string, to: string): Promise<string[]> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/admin/bookings/booked-products?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.productIds;
}

function BookingItemRow({
  index,
  control,
  products,
  bookedProductIds,
  rentalStartDate,
  rentalEndDate,
  canRemove,
  onRemove,
  onProductChange,
  onConflictChange,
}: {
  index: number;
  control: Control<BookingCreateInput>;
  products: ProductOption[];
  bookedProductIds: Set<string>;
  rentalStartDate: string;
  rentalEndDate: string;
  canRemove: boolean;
  onRemove: () => void;
  onProductChange: (index: number) => void;
  onConflictChange: (index: number, hasConflict: boolean) => void;
}) {
  const productValue = useWatch({ control, name: `items.${index}.product` });
  const pricePerDayValue = useWatch({ control, name: `items.${index}.pricePerDay` }) || 0;

  const selectedProduct = products.find((p) => p._id === productValue);
  const days = daysBetween(rentalStartDate, rentalEndDate);
  const fee = days > 0 ? pricePerDayValue * days : 0;

  const availabilityQuery = useQuery({
    queryKey: ["admin", "product-availability", productValue, rentalStartDate, rentalEndDate],
    queryFn: () => fetchAvailability(productValue, rentalStartDate, rentalEndDate),
    enabled: Boolean(productValue && rentalStartDate && rentalEndDate),
  });

  const hasConflict = availabilityQuery.data?.available === false;

  useEffect(() => {
    onConflictChange(index, hasConflict);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConflict, index]);

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <FormField
          control={control}
          name={`items.${index}.product`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dress</FormLabel>
              <FormControl>
                <SearchableSelect
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    onProductChange(index);
                  }}
                  placeholder="Select dress"
                  searchPlaceholder="Search by name, code, or color..."
                  emptyText="No dresses found."
                  options={products.map((product) => {
                    const isBooked =
                      bookedProductIds.has(product._id) && product._id !== field.value;
                    return {
                      value: product._id,
                      label: `${product.name} (${product.sku})`,
                      sublabel: isBooked
                        ? "Already booked for these dates"
                        : `${product.color} · ${formatCurrency(product.rentalPricePerDay)}/day`,
                      disabled: isBooked,
                    };
                  })}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`items.${index}.color`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <Input placeholder="Color" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`items.${index}.pricePerDay`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rent/Day (&#8377;)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  value={field.value === 0 ? "" : field.value}
                  onChange={(event) => field.onChange(Number(event.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canRemove}
            onClick={onRemove}
            aria-label="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedProduct && days > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {formatCurrency(fee)} rental ({days} day{days === 1 ? "" : "s"})
        </p>
      )}

      {hasConflict && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            This dress is already booked for an overlapping date range
            {availabilityQuery.data?.conflicts[0]
              ? ` (${availabilityQuery.data.conflicts[0].bookingNumber})`
              : ""}
            . Choose different dates or a different dress.
          </p>
        </div>
      )}
    </div>
  );
}

export function BookingForm({
  customers,
  products,
}: {
  customers: CustomerOption[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [customerList, setCustomerList] = useState<CustomerOption[]>(customers);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [securityTouched, setSecurityTouched] = useState(false);

  const form = useForm<BookingCreateInput>({
    resolver: zodResolver(bookingCreateSchema),
    defaultValues: {
      customer: "",
      billNumber: "",
      bookingDate: todayIso(),
      items: [{ product: "", color: "", pricePerDay: 0 }],
      rentalStartDate: "",
      rentalEndDate: "",
      securityDeposit: 0,
      advancePaid: 0,
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const customerValue = form.watch("customer");
  const rentalStartDate = form.watch("rentalStartDate");
  const rentalEndDate = form.watch("rentalEndDate");
  const items = form.watch("items");
  const securityDepositValue = form.watch("securityDeposit") ?? 0;
  const advancePaidValue = form.watch("advancePaid") ?? 0;

  const days = daysBetween(rentalStartDate, rentalEndDate);
  const rentTotal = items.reduce((sum, item) => {
    if (!item.product || !days) return sum;
    return sum + (item.pricePerDay || 0) * days;
  }, 0);
  const grandTotal = rentTotal + securityDepositValue;
  const dueAmount = grandTotal - advancePaidValue;

  const suggestedSecurityDeposit = items.reduce((sum, item) => {
    const product = products.find((p) => p._id === item.product);
    return product ? sum + product.securityDeposit : sum;
  }, 0);

  // Flags dresses already held by another active booking for these dates so
  // the picker can show that upfront, before the user selects one.
  const bookedProductsQuery = useQuery({
    queryKey: ["admin", "booked-products", rentalStartDate, rentalEndDate],
    queryFn: () => fetchBookedProductIds(rentalStartDate, rentalEndDate),
    enabled: Boolean(rentalStartDate && rentalEndDate),
  });
  const bookedProductIds = new Set(bookedProductsQuery.data ?? []);

  useEffect(() => {
    if (!securityTouched) {
      form.setValue("securityDeposit", suggestedSecurityDeposit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedSecurityDeposit, securityTouched]);

  const [conflicts, setConflicts] = useState<Record<number, boolean>>({});
  const hasAnyConflict = Object.values(conflicts).some(Boolean);

  function handleConflictChange(index: number, hasConflict: boolean) {
    setConflicts((prev) => (prev[index] === hasConflict ? prev : { ...prev, [index]: hasConflict }));
  }

  function handleProductChange(index: number) {
    const productId = form.getValues(`items.${index}.product`);
    const product = products.find((p) => p._id === productId);
    if (product) {
      form.setValue(`items.${index}.color`, product.color);
      form.setValue(`items.${index}.pricePerDay`, product.rentalPricePerDay);
    }
  }

  const mutation = useMutation({
    mutationFn: async (values: BookingCreateInput) => {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.booking;
    },
    onSuccess: () => {
      toast.success("Booking created");
      router.push("/admin/bookings");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const quickCustomerForm = useForm<QuickCustomerInput>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: { name: "", phone: "", relation: "S/O", relationName: "", addressLine1: "" },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (values: QuickCustomerInput) => {
      const digits = values.phone.replace(/[^0-9]/g, "") || "customer";
      const payload: CustomerCreateInput = {
        name: values.name,
        // Walk-in bookings usually don't come with an email — generate a
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
    onSuccess: (customer) => {
      toast.success("Customer created");
      setCustomerList((prev) => [...prev, { _id: customer._id, name: customer.name, email: customer.email }]);
      form.setValue("customer", customer._id);
      quickCustomerForm.reset();
      setNewCustomerOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-6"
      >
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg">Booking Details</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="billNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill Number (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Manual bill/register no." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bookingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Booking Date</FormLabel>
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
            name="customer"
            render={() => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <div className="flex gap-2">
                  <SearchableSelect
                    value={customerValue}
                    onChange={(value) => form.setValue("customer", value)}
                    placeholder="Select customer"
                    searchPlaceholder="Search by name or email..."
                    emptyText="No customers found."
                    options={customerList.map((customer) => ({
                      value: customer._id,
                      label: customer.name,
                      sublabel: customer.email,
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
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="rentalStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pickup Date</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rentalEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Date</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg">Items</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ product: "", color: "", pricePerDay: 0 })}
            >
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>

          {fields.map((field, index) => (
            <BookingItemRow
              key={field.id}
              index={index}
              control={form.control}
              products={products}
              bookedProductIds={bookedProductIds}
              rentalStartDate={rentalStartDate}
              rentalEndDate={rentalEndDate}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
              onProductChange={handleProductChange}
              onConflictChange={handleConflictChange}
            />
          ))}
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg">Measurements</h2>
          <p className="text-xs text-muted-foreground">In inches, all optional</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {BOOKING_MEASUREMENT_FIELDS.map(({ key, label }) => (
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
                <FormLabel className="text-xs">Others</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Any other measurement notes"
                    value={(field.value as string | undefined) ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg">Notes</h2>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg">Payment Details</h2>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rent Total ({days || 0} day{days === 1 ? "" : "s"})</span>
            <span className="font-medium">{formatCurrency(rentTotal)}</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="securityDeposit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Security Amount (&#8377;)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value === 0 ? "" : field.value}
                      onChange={(event) => {
                        setSecurityTouched(true);
                        field.onChange(Number(event.target.value) || 0);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="advancePaid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Advance Amount (&#8377;)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value === 0 ? "" : field.value}
                      onChange={(event) => field.onChange(Number(event.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Total Amount (rent + security)</span>
            <span className="font-heading text-xl">{formatCurrency(grandTotal)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Due Amount (total &minus; advance)</span>
            <span className="font-heading text-xl text-accent">{formatCurrency(dueAmount)}</span>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending || hasAnyConflict}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Booking
          </Button>
        </div>
      </form>
    </Form>

    <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <Form {...quickCustomerForm}>
          <form
            onSubmit={quickCustomerForm.handleSubmit((values) =>
              createCustomerMutation.mutate(values)
            )}
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
                    <Input placeholder="9876543210" {...field} />
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
