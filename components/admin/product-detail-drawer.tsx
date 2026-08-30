"use client";

import { useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SheetDetailSkeleton } from "@/components/admin/page-skeletons";
import { AuditLogList } from "@/components/admin/audit-log-list";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { ServiceOrderStatusBadge } from "@/components/admin/service-order-status-badge";
import { ProductStatusBadge } from "@/components/admin/product-status-badge";
import { ProductAvailabilityCalendar } from "@/components/admin/product-availability-calendar";
import { ImagePreviewDialog } from "@/components/admin/image-preview-dialog";
import { cn, formatDate } from "@/lib/utils";
import type { BookingStatus } from "@/models/Booking";
import type { ServiceOrderStatus } from "@/models/ServiceOrder";
import type { ProductStatus } from "@/models/Product";

interface ProductDetail {
  _id: string;
  name: string;
  sku: string;
  description: string;
  designer?: string;
  dealerName?: string;
  color: string;
  fabric: string;
  dressType?: string;
  work?: string;
  images: string[];
  category: { name: string } | null;
  variants: { size: string; quantityInStock: number }[];
  rentalPricePerDay: number;
  purchasePrice?: number;
  transportCost?: number;
  stitchingCost?: number;
  otherCost?: number;
  retailValue: number;
  securityDeposit: number;
  status: ProductStatus;
  isActive: boolean;
  tags: string[];
}

interface ProductHistoryBooking {
  _id: string;
  bookingNumber: string;
  customerName: string;
  status: BookingStatus;
  rentalStartDate: string;
  rentalEndDate: string;
  totalAmount: number;
  productRevenue: number;
}

interface ProductHistoryServiceOrder {
  _id: string;
  serviceType: "dry_clean" | "tailor";
  status: ServiceOrderStatus;
  sentDate: string;
  expectedReturnDate: string;
  totalAmount: number;
}

interface ProductHistorySummary {
  totalBookings: number;
  totalServiceOrders: number;
  timesRented: number;
  totalEarned: number;
  saleEarned: number;
  acquisitionCost: number;
  totalServiceExpense: number;
  totalExpense: number;
  netAmount: number;
}

interface ProductHistory {
  bookings: ProductHistoryBooking[];
  serviceOrders: ProductHistoryServiceOrder[];
  activeRanges: { bookingNumber: string; rentalStartDate: string; rentalEndDate: string }[];
  summary: ProductHistorySummary;
}

function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

async function fetchProduct(id: string): Promise<ProductDetail> {
  const res = await fetch(`/api/admin/products/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.product;
}

async function fetchProductHistory(id: string): Promise<ProductHistory> {
  const res = await fetch(`/api/admin/products/${id}/history`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function ProductDetailDrawer({
  productId,
  onClose,
}: {
  productId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [previewIndex, setPreviewIndex] = useState(-1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["admin", "product-detail", productId],
    queryFn: () => fetchProduct(productId as string),
    enabled: Boolean(productId),
  });

  const { data: history } = useQuery({
    queryKey: ["admin", "product-history", productId],
    queryFn: () => fetchProductHistory(productId as string),
    enabled: Boolean(productId),
  });

  const setCoverMutation = useMutation({
    mutationFn: async (images: string[]) => {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Cover image updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "product-detail", productId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setPreviewIndex(0);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function setCoverImage(index: number) {
    if (!product || index <= 0 || index >= product.images.length) return;
    const { images } = product;
    setCoverMutation.mutate([images[index], ...images.slice(0, index), ...images.slice(index + 1)]);
  }

  return (
    <Sheet open={productId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {isLoading || !product ? (
          <SheetDetailSkeleton />
        ) : (
          <>
            <SheetHeader className="border-b border-border pr-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="font-heading text-xl">{product.name}</SheetTitle>
                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Badge variant={product.isActive ? "default" : "secondary"} className="rounded-full">
                    {product.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {product.status === "sold" && <ProductStatusBadge status="sold" />}
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-6 p-6">
              {product.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {product.images.map((image, index) => (
                    <button
                      type="button"
                      key={image + index}
                      onClick={() => setPreviewIndex(index)}
                      aria-label={index === 0 ? "Preview cover image" : `Preview image ${index + 1}`}
                      className={cn(
                        "relative h-24 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-md border bg-secondary",
                        index === 0 ? "border-accent ring-1 ring-accent" : "border-transparent"
                      )}
                    >
                      <Image src={image} alt={product.name} fill sizes="80px" className="object-cover" />
                      {index === 0 && (
                        <span className="pointer-events-none absolute bottom-1 left-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-foreground">
                          <Star className="h-2.5 w-2.5 fill-current" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <ImagePreviewDialog
                images={product.images}
                index={previewIndex}
                onIndexChange={setPreviewIndex}
                onOpenChange={(open) => !open && setPreviewIndex(-1)}
                title={product.name}
                onSetCover={setCoverImage}
                isSettingCover={setCoverMutation.isPending}
              />

              <Tabs defaultValue="details">
                {/*
                  Four flex-1 tabs sharing a ~330px-wide sheet on mobile give
                  each trigger ~80px, and "Availability" (12 chars) at
                  text-sm + the base component's whitespace-nowrap ran past
                  that width with nothing to clip it — the label visibly
                  overlapped the "Activity" tab beside it. min-w-0 lets a
                  flex-1 item shrink below its content size and truncate
                  then actually has room to ellipsize instead of overflowing.
                */}
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="min-w-0 flex-1 truncate text-xs sm:text-sm">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="history" className="min-w-0 flex-1 truncate text-xs sm:text-sm">
                    History
                  </TabsTrigger>
                  <TabsTrigger value="availability" className="min-w-0 flex-1 truncate text-xs sm:text-sm">
                    Availability
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="min-w-0 flex-1 truncate text-xs sm:text-sm">
                    Activity
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Category</p>
                      <p className="mt-0.5">{product.category?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Designer</p>
                      <p className="mt-0.5">{product.designer || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Dealer Name</p>
                      <p className="mt-0.5">{product.dealerName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Color</p>
                      <p className="mt-0.5">{product.color}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Fabric</p>
                      <p className="mt-0.5">{product.fabric}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Dress Type</p>
                      <p className="mt-0.5">{product.dressType || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Work</p>
                      <p className="mt-0.5">{product.work || "—"}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Description</p>
                    <p className="mt-1 text-sm leading-relaxed">{product.description}</p>
                  </div>

                  <div className="rounded-lg border border-border p-3 text-sm">
                    <p className="text-xs uppercase text-muted-foreground">Rent</p>
                    <p className="mt-0.5 font-medium">
                      &#8377;{product.rentalPricePerDay.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Purchase Price</p>
                      <p className="mt-0.5 font-medium">
                        &#8377;{(product.purchasePrice ?? 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Stitching Cost</p>
                      <p className="mt-0.5 font-medium">
                        &#8377;{(product.stitchingCost ?? 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Transport Cost</p>
                      <p className="mt-0.5 font-medium">
                        &#8377;{(product.transportCost ?? 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Other Cost</p>
                      <p className="mt-0.5 font-medium">
                        &#8377;{(product.otherCost ?? 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Sizes &amp; Stock</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {product.variants.map((variant) => (
                        <Badge key={variant.size} variant="secondary" className="rounded-full">
                          {variant.size}: {variant.quantityInStock}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {product.tags.length > 0 && (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Tags</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {product.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="rounded-full">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <ButtonLink href={`/admin/products/${product._id}`} className="w-full">
                    Edit Full Details
                  </ButtonLink>
                </TabsContent>

                <TabsContent value="history" className="space-y-5">
                  {history && (
                    <div className="rounded-lg border border-border bg-secondary/40 p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Times Rented</p>
                          <p className="mt-0.5 font-medium">{history.summary.timesRented}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Earned</p>
                          <p className="mt-0.5 font-medium">{formatINR(history.summary.totalEarned)}</p>
                          {history.summary.saleEarned > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              incl. {formatINR(history.summary.saleEarned)} from sale
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Expenses</p>
                          <p className="mt-0.5 font-medium">{formatINR(history.summary.totalExpense)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatINR(history.summary.acquisitionCost)} acquisition +{" "}
                            {formatINR(history.summary.totalServiceExpense)} dry-clean/repair
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Total (Net)</p>
                          <p
                            className={cn(
                              "mt-0.5 font-medium",
                              history.summary.netAmount >= 0 ? "text-accent" : "text-destructive"
                            )}
                          >
                            {formatINR(history.summary.netAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Bookings ({history?.bookings.length ?? 0})
                    </p>
                    <div className="mt-2 space-y-2">
                      {!history || history.bookings.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No bookings for this dress yet.
                        </p>
                      ) : (
                        history.bookings.map((booking) => (
                          <div
                            key={booking._id}
                            className="rounded-lg border border-border p-3 text-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{booking.bookingNumber}</span>
                              <BookingStatusBadge status={booking.status} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {booking.customerName} &middot; {formatDate(booking.rentalStartDate)} to{" "}
                              {formatDate(booking.rentalEndDate)}
                            </p>
                            <p className="mt-1 text-xs">
                              {formatINR(booking.productRevenue)} from this dress
                              {booking.totalAmount !== booking.productRevenue && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  (booking total {formatINR(booking.totalAmount)})
                                </span>
                              )}
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
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No dry-clean or repair orders for this dress yet.
                        </p>
                      ) : (
                        history.serviceOrders.map((order) => (
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
                </TabsContent>

                <TabsContent value="availability" className="space-y-3">
                  {product.status === "sold" && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300">
                      This dress has been sold outright and is no longer available for rental.
                    </div>
                  )}
                  <ProductAvailabilityCalendar activeRanges={history?.activeRanges ?? []} />
                </TabsContent>

                <TabsContent value="activity">
                  <AuditLogList entityType="Product" entityId={product._id} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
