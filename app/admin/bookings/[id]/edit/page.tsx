import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { Product } from "@/models/Product";
import { BookingForm } from "@/components/admin/booking-form";
import type { BookingCreateInput } from "@/lib/validations/booking";

export const metadata: Metadata = { title: "Edit Booking" };

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectToDatabase();

  const [booking, customers, activeProducts] = await Promise.all([
    Booking.findById(id).lean(),
    User.find({ role: "customer", deletedAt: null })
      .select("name email phone")
      .sort({ name: 1 })
      .limit(200)
      .lean(),
    // A dress that's been sold outright is no longer available to rent —
    // still merged back in below if this booking's own items reference it.
    Product.find({ isActive: true, deletedAt: null, archivedAt: null, status: { $ne: "sold" } })
      .select("name sku color rentalPricePerDay securityDeposit variants")
      .sort({ name: 1 })
      .limit(200)
      .lean(),
  ]);

  if (!booking) {
    notFound();
  }

  // A dress already on this booking might since have been archived or
  // deactivated — still include it in the picker (so it shows its real name
  // instead of a blank row) even though it's excluded from the active list
  // new items are chosen from.
  const activeProductIds = new Set(activeProducts.map((product) => String(product._id)));
  const missingProductIds = [
    ...new Set(
      booking.items.map((item) => String(item.product)).filter((id) => !activeProductIds.has(id))
    ),
  ];
  const extraProducts = missingProductIds.length
    ? await Product.find({ _id: { $in: missingProductIds } })
        .select("name sku color rentalPricePerDay securityDeposit variants")
        .lean()
    : [];
  const products = [...activeProducts, ...extraProducts];

  // Once returned/cancelled, the booking's totals feed a settlement that's
  // already been computed (and often paid out) — the API rejects an edit at
  // that point too, but heading it off here avoids sending someone into a
  // form whose Save will just fail.
  if (booking.status === "returned" || booking.status === "cancelled") {
    return (
      <div className="max-w-3xl space-y-6">
        <Link
          href={`/admin/bookings/${id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Booking
        </Link>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="font-heading text-2xl">Booking Can&rsquo;t Be Edited</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This booking has already been {booking.status} and its totals are part of a completed
            settlement, so its details can no longer be changed.
          </p>
        </div>
      </div>
    );
  }

  const defaultValues: BookingCreateInput = {
    customer: String(booking.customer),
    billNumber: booking.billNumber ?? "",
    bookingDate: toIsoDate(booking.bookingDate ?? booking.createdAt ?? new Date()),
    items: booking.items.map((item) => ({
      product: String(item.product),
      color: item.color ?? "",
      pricePerDay: item.pricePerDay,
      wearerName: item.wearerName ?? "",
      measurements: item.measurements,
    })),
    rentalStartDate: toIsoDate(booking.rentalStartDate),
    rentalEndDate: toIsoDate(booking.rentalEndDate),
    eventDate: toIsoDate(booking.eventDate),
    deliveryAddress: booking.deliveryAddress ?? "",
    securityDeposit: booking.securityDeposit,
    advancePaid: booking.advancePaid ?? 0,
    advancePaymentMethod: booking.advancePaymentMethod ?? "",
    measurements: booking.measurements,
    notes: booking.notes ?? "",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/admin/bookings/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Booking
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Edit Booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Booking {booking.bookingNumber}. Overlapping dates against other bookings are still
          blocked automatically.
        </p>
      </div>

      <BookingForm
        bookingId={id}
        defaultValues={defaultValues}
        customers={customers.map((customer) => ({
          _id: String(customer._id),
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        }))}
        products={products.map((product) => ({
          _id: String(product._id),
          name: product.name,
          sku: product.sku,
          color: product.color,
          rentalPricePerDay: product.rentalPricePerDay,
          securityDeposit: product.securityDeposit,
          variants: product.variants.map((variant) => ({
            size: variant.size,
            quantityInStock: variant.quantityInStock,
          })),
        }))}
      />
    </div>
  );
}
