import "server-only";
import { Booking } from "@/models/Booking";
import type { BookingStatus } from "@/models/Booking";

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["pending_payment", "confirmed", "in_use"];

export interface BookingConflict {
  _id: string;
  bookingNumber: string;
  rentalStartDate: Date;
  rentalEndDate: Date;
  status: BookingStatus;
}

/**
 * All product IDs with an active booking overlapping the given date range —
 * used to pre-mark already-booked dresses in the item picker before the
 * user selects one, instead of only warning after the fact.
 */
export async function findBookedProductIds(
  rentalStartDate: Date,
  rentalEndDate: Date,
  excludeBookingId?: string
): Promise<string[]> {
  const filter: Record<string, unknown> = {
    status: { $in: ACTIVE_BOOKING_STATUSES },
    rentalStartDate: { $lte: rentalEndDate },
    rentalEndDate: { $gte: rentalStartDate },
  };
  if (excludeBookingId) {
    filter._id = { $ne: excludeBookingId };
  }

  const productIds = await Booking.find(filter).distinct("items.product");
  return productIds.map((id) => String(id));
}

export async function findBookingConflicts(
  productId: string,
  rentalStartDate: Date,
  rentalEndDate: Date,
  excludeBookingId?: string
): Promise<BookingConflict[]> {
  const filter: Record<string, unknown> = {
    "items.product": productId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    rentalStartDate: { $lte: rentalEndDate },
    rentalEndDate: { $gte: rentalStartDate },
  };
  if (excludeBookingId) {
    filter._id = { $ne: excludeBookingId };
  }

  const conflicts = await Booking.find(filter)
    .select("bookingNumber rentalStartDate rentalEndDate status")
    .lean();

  return conflicts.map((booking) => ({
    _id: String(booking._id),
    bookingNumber: booking.bookingNumber,
    rentalStartDate: booking.rentalStartDate,
    rentalEndDate: booking.rentalEndDate,
    status: booking.status,
  }));
}
