import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import "@/models/User";
import "@/models/Product";
import { BookingsClient } from "@/components/admin/bookings-client";

export const metadata: Metadata = { title: "Bookings" };

const PAGE_SIZE = 5;

export default async function AdminBookingsPage() {
  const currentUser = await getCurrentUser();
  const canManageSettings = Boolean(currentUser && SETTINGS_ROLES.includes(currentUser.role));

  await connectToDatabase();

  const [bookings, total, summaryAgg, statusAgg] = await Promise.all([
    // Matches the client's default sort (soonest-upcoming rental first) so
    // the server-rendered first page doesn't flash a different order before
    // the client takes over.
    Booking.find({ deletedAt: null })
      .populate("customer", "name email phone")
      .populate("items.product", "name images")
      .sort({ rentalStartDate: 1 })
      .limit(PAGE_SIZE)
      .lean(),
    Booking.countDocuments({ deletedAt: null }),
    Booking.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          securityDeposit: { $sum: "$securityDeposit" },
          advancePaid: { $sum: "$advancePaid" },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
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
          phone: (booking.customer as unknown as { phone?: string }).phone,
        }
      : null,
    items: booking.items.map((item) => ({
      product: item.product
        ? { name: (item.product as unknown as { name: string }).name }
        : null,
    })),
  }));

  const summaryRow = summaryAgg[0] ?? { totalAmount: 0, securityDeposit: 0, advancePaid: 0 };

  const rawStatusCounts: Record<string, number> = {};
  for (const row of statusAgg as { _id: string; count: number }[]) {
    rawStatusCounts[row._id] = row.count;
  }

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
      initialStatusCounts={{
        all: Object.values(rawStatusCounts).reduce((sum, count) => sum + count, 0),
        new: (rawStatusCounts.inquiry ?? 0) + (rawStatusCounts.pending_payment ?? 0),
        confirmed: rawStatusCounts.confirmed ?? 0,
        in_use: rawStatusCounts.in_use ?? 0,
        returned: rawStatusCounts.returned ?? 0,
        cancelled: rawStatusCounts.cancelled ?? 0,
      }}
      canManageSettings={canManageSettings}
    />
  );
}
