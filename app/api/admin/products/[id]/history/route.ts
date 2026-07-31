import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { ServiceOrder } from "@/models/ServiceOrder";
import "@/models/User";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/admin/booking-availability";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return apiError("Invalid product id", 400);
  }
  const productObjectId = new Types.ObjectId(id);

  await connectToDatabase();

  const [product, bookings, serviceOrders, revenueAgg, serviceExpenseAgg] = await Promise.all([
    Product.findById(id).select("purchasePrice stitchingCost transportCost").lean(),
    Booking.find({ "items.product": id })
      .populate("customer", "name")
      .select("bookingNumber customer status rentalStartDate rentalEndDate totalAmount items createdAt")
      .sort({ rentalStartDate: -1 })
      .limit(50)
      .lean(),
    ServiceOrder.find({ product: id, deletedAt: null })
      .select("serviceType status sentDate expectedReturnDate completedDate totalAmount createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    // Computed across every booking this dress has ever been in — not just
    // the 50 most recent shown in the list below — so the summary numbers
    // are always the true lifetime totals.
    Booking.aggregate([
      { $match: { "items.product": productObjectId } },
      { $unwind: "$items" },
      { $match: { "items.product": productObjectId } },
      {
        $group: {
          _id: null,
          timesRented: { $sum: "$items.quantity" },
          // Cancelled bookings never actually happened, so they don't count
          // as earned revenue (they still show up in the history list).
          totalEarned: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$items.rentalFee"] },
          },
        },
      },
    ]),
    ServiceOrder.aggregate([
      { $match: { product: productObjectId, deletedAt: null } },
      { $group: { _id: null, totalServiceExpense: { $sum: "$totalAmount" } } },
    ]),
  ]);

  const mappedBookings = bookings.map((b) => {
    const productRevenue = b.items
      .filter((item) => String(item.product) === id)
      .reduce((sum, item) => sum + item.rentalFee, 0);
    return {
      _id: String(b._id),
      bookingNumber: b.bookingNumber,
      customerName: (b.customer as unknown as { name: string } | null)?.name ?? "—",
      status: b.status,
      rentalStartDate: b.rentalStartDate.toISOString(),
      rentalEndDate: b.rentalEndDate.toISOString(),
      totalAmount: b.totalAmount,
      productRevenue,
    };
  });

  const activeRanges = mappedBookings
    .filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status))
    .map((b) => ({
      bookingNumber: b.bookingNumber,
      rentalStartDate: b.rentalStartDate,
      rentalEndDate: b.rentalEndDate,
    }));

  const mappedServiceOrders = serviceOrders.map((s) => ({
    _id: String(s._id),
    serviceType: s.serviceType,
    status: s.status,
    sentDate: s.sentDate.toISOString(),
    expectedReturnDate: s.expectedReturnDate.toISOString(),
    completedDate: s.completedDate ? s.completedDate.toISOString() : null,
    totalAmount: s.totalAmount,
  }));

  const timesRented = revenueAgg[0]?.timesRented ?? 0;
  const totalEarned = revenueAgg[0]?.totalEarned ?? 0;
  const totalServiceExpense = serviceExpenseAgg[0]?.totalServiceExpense ?? 0;
  // One-time cost of getting this dress into the store — set on the product
  // itself (purchase, stitching, transport), on top of ongoing dry-clean/
  // repair costs above.
  const acquisitionCost =
    (product?.purchasePrice ?? 0) + (product?.stitchingCost ?? 0) + (product?.transportCost ?? 0);
  const totalExpense = totalServiceExpense + acquisitionCost;
  const netAmount = totalEarned - totalExpense;

  return apiSuccess({
    bookings: mappedBookings,
    serviceOrders: mappedServiceOrders,
    activeRanges,
    summary: {
      totalBookings: mappedBookings.length,
      totalServiceOrders: mappedServiceOrders.length,
      timesRented,
      totalEarned,
      acquisitionCost,
      totalServiceExpense,
      totalExpense,
      netAmount,
    },
  });
}
