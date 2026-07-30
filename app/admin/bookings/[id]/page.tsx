import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import "@/models/User";
import "@/models/Product";
import { BookingDetailClient } from "@/components/admin/booking-detail-client";

export const metadata: Metadata = { title: "Booking Detail" };

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectToDatabase();

  const booking = await Booking.findById(id)
    .populate("customer", "name email phone")
    .populate("items.product", "name images sku")
    .lean();

  if (!booking) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Bookings
      </Link>

      <BookingDetailClient
        initialBooking={{
          _id: String(booking._id),
          bookingNumber: booking.bookingNumber,
          billNumber: booking.billNumber,
          bookingDate: booking.bookingDate.toISOString(),
          status: booking.status,
          customer: booking.customer
            ? {
                name: (booking.customer as unknown as { name: string }).name,
                email: (booking.customer as unknown as { email: string }).email,
                phone: (booking.customer as unknown as { phone?: string }).phone,
              }
            : null,
          items: booking.items.map((item) => ({
            product: item.product
              ? {
                  _id: String((item.product as unknown as { _id: unknown })._id),
                  name: (item.product as unknown as { name: string }).name,
                  images: (item.product as unknown as { images: string[] }).images,
                  sku: (item.product as unknown as { sku: string }).sku,
                }
              : null,
            size: item.size,
            quantity: item.quantity,
            pricePerDay: item.pricePerDay,
            rentalFee: item.rentalFee,
          })),
          rentalStartDate: booking.rentalStartDate.toISOString(),
          rentalEndDate: booking.rentalEndDate.toISOString(),
          eventDate: booking.eventDate.toISOString(),
          securityDeposit: booking.securityDeposit,
          totalAmount: booking.totalAmount,
          advancePaid: booking.advancePaid,
          deliveryAddress: booking.deliveryAddress,
          notes: booking.notes,
          returnCondition: booking.returnCondition,
          returnNotes: booking.returnNotes,
          returnedAt: booking.returnedAt ? booking.returnedAt.toISOString() : null,
          dryCleaningRequired: booking.dryCleaningRequired,
          stitchingRequired: booking.stitchingRequired,
          damageCharges: booking.damageCharges,
          pendingRentAmount: booking.pendingRentAmount,
          depositRefunded: booking.depositRefunded,
          depositRefundAmount: booking.depositRefundAmount,
          finalSettlementAmount: booking.finalSettlementAmount,
          createdAt: booking.createdAt.toISOString(),
        }}
      />
    </div>
  );
}
