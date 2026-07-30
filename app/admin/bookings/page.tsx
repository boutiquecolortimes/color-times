import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import "@/models/User";
import "@/models/Product";
import { BookingsClient } from "@/components/admin/bookings-client";

export const metadata: Metadata = { title: "Bookings" };

const PAGE_SIZE = 20;

export default async function AdminBookingsPage() {
  await connectToDatabase();

  const [bookings, total, summaryAgg] = await Promise.all([
    Booking.find()
      .populate("customer", "name email")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    Booking.countDocuments(),
    Booking.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          securityDeposit: { $sum: "$securityDeposit" },
          advancePaid: { $sum: "$advancePaid" },
        },
      },
    ]),
  ]);

  const initialBookings = bookings.map((booking) => ({
    _id: String(booking._id),
    bookingNumber: booking.bookingNumber,
    billNumber: booking.billNumber,
    // Older bookings (created before bookingDate existed on the schema) don't
    // have this field stored on the document — .lean() reads don't backfill
    // schema defaults, so fall back to when the booking record was created.
    bookingDate: (booking.bookingDate ?? booking.createdAt ?? new Date()).toISOString(),
    status: booking.status,
    rentalStartDate: booking.rentalStartDate.toISOString(),
    rentalEndDate: booking.rentalEndDate.toISOString(),
    totalAmount: booking.totalAmount,
    securityDeposit: booking.securityDeposit,
    advancePaid: booking.advancePaid ?? 0,
    customer: booking.customer
      ? {
          name: (booking.customer as unknown as { name: string }).name,
          email: (booking.customer as unknown as { email: string }).email,
        }
      : null,
    items: booking.items.map((item) => ({
      product: item.product
        ? { name: (item.product as unknown as { name: string }).name }
        : null,
    })),
  }));

  const summaryRow = summaryAgg[0] ?? { totalAmount: 0, securityDeposit: 0, advancePaid: 0 };

  return (
    <BookingsClient
      initialBookings={initialBookings}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
      initialSummary={{
        totalAmount: summaryRow.totalAmount,
        securityDeposit: summaryRow.securityDeposit,
        advancePaid: summaryRow.advancePaid,
        dueAmount: summaryRow.totalAmount - summaryRow.advancePaid,
      }}
    />
  );
}
