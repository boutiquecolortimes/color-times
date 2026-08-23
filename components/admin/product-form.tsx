"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { ServiceOrderStatusBadge } from "@/components/admin/service-order-status-badge";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { formatDate } from "@/lib/utils";
import type { BookingStatus } from "@/models/Booking";
import type { ServiceOrderStatus } from "@/models/ServiceOrder";

interface CategoryOption {
  _id: string;
  name: string;
}

interface ProductFormProps {
  categories: CategoryOption[];
  productId?: string;
  defaultValues?: ProductInput;
}

interface ProductHistoryBooking {
  _id: string;
  bookingNumber: string;
  customerName: string;
  status: BookingStatus;
  rentalStartDate: string;
  rentalEndDate: string;
  totalAmount: number;
}

interface ProductHistoryServiceOrder {
  _id: string;
  serviceType: "dry_clean" | "tailor";
  status: ServiceOrderStatus;
  sentDate: string;
  expectedReturnDate: string;
  totalAmount: number;
}

interface ProductHistory {
  bookings: ProductHistoryBooking[];
  serviceOrders: ProductHistoryServiceOrder[];
}

async function fetchProductHistory(id: string): Promise<ProductHistory> {
  const res = await fetch(`/api/admin/products/${id}/history`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const TAB_ORDER = ["basic", "images", "pricing", "other"] as const;
const TAB_LABELS: Record<(typeof TAB_ORDER)[number], string> = {
  basic: "Basic Info",
  images: "Images",
  pricing: "Pricing",
  other: "Other",
};

const FIELD_TABS: Record<string, string> = {
  name: "basic",
  slug: "basic",
  sku: "basic",
  category: "basic",
  color: "basic",
  fabric: "basic",
  dressType: "basic",
  work: "basic",
  description: "basic",
  images: "images",
  rentalPricePerDay: "pricing",
  purchasePrice: "pricing",
  transportCost: "pricing",
  stitchingCost: "pricing",
  otherCost: "pricing",
  variants: "other",
  designer: "other",
  dealerName: "other",
  status: "other",
  isFeatured: "other",
  isNewArrival: "other",
};

export function ProductForm({ categories, productId, defaultValues }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(productId);
  const [activeTab, setActiveTab] = useState<(typeof TAB_ORDER)[number]>("basic");
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(["basic"]));
  // The bottom-right button is "Next" on every tab except the last, where it
  // becomes the real Submit button in that exact same screen spot. Arriving
  // there mid-click (e.g. a habitual second click after using "Next" a few
  // times) could land squarely on Submit and create the product by accident.
  // Briefly disabling it right after the last tab becomes active closes that
  // window without adding any friction for someone deliberately reviewing it.
  const [submitArmed, setSubmitArmed] = useState(false);

  function goToTab(tab: (typeof TAB_ORDER)[number]) {
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set(prev).add(tab));
  }

  useEffect(() => {
    if (activeTab !== TAB_ORDER[TAB_ORDER.length - 1]) {
      setSubmitArmed(false);
      return;
    }
    setSubmitArmed(false);
    const timer = setTimeout(() => setSubmitArmed(true), 600);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultValues ?? {
      name: "",
      slug: "",
      sku: "",
      category: categories[0]?._id ?? "",
      designer: "",
      dealerName: "",
      description: "",
      color: "",
      fabric: "",
      dressType: "",
      work: "",
      images: [],
      variants: [{ size: "M", quantityInStock: 0 }],
      rentalPricePerDay: 0,
      purchasePrice: 0,
      stitchingCost: 0,
      transportCost: 0,
      otherCost: 0,
      isFeatured: false,
      isNewArrival: false,
      isActive: true,
      tags: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  const { data: history } = useQuery({
    queryKey: ["admin", "product-history", productId],
    queryFn: () => fetchProductHistory(productId as string),
    enabled: Boolean(productId),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ProductInput) => {
      const url = isEditing ? `/api/admin/products/${productId}` : "/api/admin/products";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.product;
    },
    onSuccess: () => {
      toast.success(isEditing ? "Product updated" : "Product created");
      // The products list's React Query cache persists across navigation
      // (it's owned by the top-level QueryClient, not this page), so
      // router.refresh() alone wasn't enough to guarantee the list showed
      // this change — it only re-runs the server component, which doesn't
      // touch an already-populated client cache. Invalidate it explicitly,
      // same as every other admin list does after its own mutations.
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      router.push("/admin/products");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onInvalid(errors: Record<string, unknown>) {
    // Zod validates every tab at once, but only the active tab's error text
    // is visible — without this, a required field on another tab makes
    // Submit look like it's doing nothing.
    const firstField = Object.keys(errors)[0];
    const tab = firstField ? (FIELD_TABS[firstField] as (typeof TAB_ORDER)[number] | undefined) : undefined;
    if (tab) goToTab(tab);
    toast.error("Please fix the highlighted field before saving.");
  }

  const currentIndex = TAB_ORDER.indexOf(activeTab);
  const isLastTab = currentIndex === TAB_ORDER.length - 1;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values), onInvalid)}
        className="space-y-6"
      >
        <p className="text-sm text-muted-foreground">
          Step {currentIndex + 1} of {TAB_ORDER.length} &middot; {TAB_LABELS[activeTab]}
        </p>
        <Tabs value={activeTab} onValueChange={(value) => goToTab((value as (typeof TAB_ORDER)[number]) ?? "basic")}>
          <TabsList className="w-full sm:w-fit">
            {TAB_ORDER.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {visitedTabs.has(tab) && tab !== activeTab && (
                  <Check className="h-3 w-3 text-emerald-600" />
                )}
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="basic" keepMounted>
            <section className="rounded-lg border border-border bg-card p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(event) => {
                            field.onChange(event);
                            if (!isEditing) form.setValue("slug", slugify(event.target.value));
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
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a category">
                              {(value: string) =>
                                categories.find((cat) => cat._id === value)?.name ??
                                "Select a category"
                              }
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat._id} value={cat._id}>
                              {cat.name}
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
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fabric"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fabric</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dressType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dress Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Unstitched, Semi-stitched, Ready-to-wear" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="work"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Zari embroidery, Mirror work" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="images" keepMounted>
            <section className="rounded-lg border border-border bg-card p-6">
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ImageUploadField images={field.value} onChange={field.onChange} multiple />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </TabsContent>

          <TabsContent value="pricing" keepMounted>
            <section className="rounded-lg border border-border bg-card p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (&#8377;)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                  name="transportCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transport Cost (&#8377;)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                  name="stitchingCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stitching Cost (&#8377;)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                  name="otherCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Cost (&#8377;)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                  name="rentalPricePerDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rent (&#8377;)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
            </section>
          </TabsContent>

          <TabsContent value="other" className="space-y-6" keepMounted>
            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg">Size &amp; Quantity</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ size: "M", quantityInStock: 0 })}
                >
                  <Plus className="h-4 w-4" />
                  Add Size
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {fields.map((fieldItem, index) => (
                  <div key={fieldItem.id} className="flex items-end gap-3">
                    <FormField
                      control={form.control}
                      name={`variants.${index}.size`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormLabel>Size</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. M, 38, Free" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`variants.${index}.quantityInStock`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              value={field.value ? field.value : ""}
                              onChange={(event) =>
                                field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Designer</h2>
              <div className="mt-4 max-w-sm">
                <FormField
                  control={form.control}
                  name="designer"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Designer name (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Dealer Name</h2>
              <div className="mt-4 max-w-sm">
                <FormField
                  control={form.control}
                  name="dealerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Dealer name (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {isEditing && (
              <section className="rounded-lg border border-border bg-card p-6">
                <h2 className="font-heading text-lg">Status</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Updates automatically when a booking is confirmed, returned, or sent for dry
                  cleaning/repair. Override manually if needed.
                </p>
                <div className="mt-4 max-w-xs">
                  <FormField
                    control={form.control}
                    name="status"
                    render={() => (
                      <FormItem>
                        <Select
                          value={form.watch("status") ?? "available"}
                          onValueChange={(value) =>
                            form.setValue("status", value as ProductInput["status"])
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="reserved">Reserved</SelectItem>
                            <SelectItem value="picked_up">Picked Up</SelectItem>
                            <SelectItem value="under_dry_cleaning">Dry Cleaning</SelectItem>
                            <SelectItem value="under_repair">Repair</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            <SelectItem value="returned">Returned</SelectItem>
                            <SelectItem value="sold">Sold</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>
            )}

            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Visibility</h2>
              <div className="mt-4 flex flex-wrap gap-6">
                {(["isFeatured", "isNewArrival"] as const).map((key) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <FormItem>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(event) => field.onChange(event.target.checked)}
                            className="h-4 w-4 rounded border-input"
                          />
                          {key === "isFeatured" && "Featured"}
                          {key === "isNewArrival" && "New Arrival"}
                        </label>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </section>

            {isEditing && (
              <section className="rounded-lg border border-border bg-card p-6">
                <h2 className="font-heading text-lg">History</h2>
                <div className="mt-4 space-y-5">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Bookings ({history?.bookings.length ?? 0})
                    </p>
                    <div className="mt-2 space-y-2">
                      {!history || history.bookings.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">
                          No bookings for this dress yet.
                        </p>
                      ) : (
                        history.bookings.slice(0, 5).map((booking) => (
                          <div key={booking._id} className="rounded-lg border border-border p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{booking.bookingNumber}</span>
                              <BookingStatusBadge status={booking.status} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {booking.customerName} &middot; {formatDate(booking.rentalStartDate)} to{" "}
                              {formatDate(booking.rentalEndDate)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Dry Clean &amp; Repair ({history?.serviceOrders.length ?? 0})
                    </p>
                    <div className="mt-2 space-y-2">
                      {!history || history.serviceOrders.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">
                          No dry-clean or repair orders for this dress yet.
                        </p>
                      ) : (
                        history.serviceOrders.slice(0, 5).map((order) => (
                          <div key={order._id} className="rounded-lg border border-border p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                {order.serviceType === "dry_clean" ? "Dry Clean" : "Tailor / Alteration"}
                              </span>
                              <ServiceOrderStatusBadge status={order.status} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Sent {formatDate(order.sentDate)} &middot; Expected{" "}
                              {formatDate(order.expectedReturnDate)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>
            Cancel
          </Button>
          <div className="flex gap-3">
            {currentIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => goToTab(TAB_ORDER[currentIndex - 1])}
              >
                Back
              </Button>
            )}
            {!isLastTab ? (
              <Button type="button" onClick={() => goToTab(TAB_ORDER[currentIndex + 1])}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={saveMutation.isPending || !submitArmed}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitArmed ? (isEditing ? "Save Changes" : "Create Product") : "Reviewing…"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
