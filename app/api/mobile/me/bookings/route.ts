import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import "@/models/Product";
import { requireApiRole } from "@/lib/api/require-role";
import { ALL_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";
import { bookingRemainingDue } from "@/lib/admin/booking-status";

/** The signed-in customer's own rentals, newest first. */
export async function GET(): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();
    const bookings = await Booking.find({ customer: auth.user.sub, deletedAt: null })
      .select(
        "bookingNumber billNumber status items rentalStartDate rentalEndDate eventDate totalAmount securityDeposit advancePaid damageCharges depositRefundAmount depositRefunded createdAt"
      )
      .populate("items.product", "name images")
      .sort({ rentalStartDate: -1 })
      .limit(100)
      .lean();

    return apiSuccess({
      bookings: bookings.map((booking) => ({
        _id: String(booking._id),
        bookingNumber: booking.bookingNumber,
        billNumber: booking.billNumber,
        status: booking.status,
        rentalStartDate: booking.rentalStartDate,
        rentalEndDate: booking.rentalEndDate,
        eventDate: booking.eventDate,
        totalAmount: booking.totalAmount,
        securityDeposit: booking.securityDeposit,
        advancePaid: booking.advancePaid ?? 0,
        remainingDue: bookingRemainingDue(booking),
        items: booking.items.map((item) => {
          const product = item.product as unknown as { _id: unknown; name: string; images: string[] } | null;
          return {
            productId: product ? String(product._id) : null,
            name: product?.name ?? "Dress",
            image: product?.images?.[0] ?? "",
            color: item.color,
            size: item.size,
            rentalFee: item.rentalFee,
          };
        }),
        createdAt: booking.createdAt,
      })),
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
