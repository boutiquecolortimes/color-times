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
 * Mongo filter for bookings whose rental period clashes with the given one.
 * A shared handover day is allowed — a dress returned on the 11th can go out
 * again on the 11th (e.g. back-to-back Navratri/Dandiya nights) — so ranges
 * that merely touch don't conflict. Two bookings picked up on the same day
 * always do, which also covers single-day rentals on the same date.
 */
function overlapFilter(rentalStartDate: Date, rentalEndDate: Date): Record<string, unknown> {
  return {
    $or: [
      { rentalStartDate: { $lt: rentalEndDate }, rentalEndDate: { $gt: rentalStartDate } },
      { rentalStartDate },
    ],
  };
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
    ...overlapFilter(rentalStartDate, rentalEndDate),
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
    ...overlapFilter(rentalStartDate, rentalEndDate),
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

export interface UpcomingBooking extends BookingConflict {
  billNumber: string;
}

/**
 * The soonest still-open booking for a product whose rental period hasn't
 * fully passed yet — "still open" meaning anything short of Returned or
 * Cancelled, inquiry included. Used before an outright Sale to stop staff
 * from selling a dress that's already promised to someone else.
 *
 * This is deliberately broader than ACTIVE_BOOKING_STATUSES above: that
 * list exists so two speculative inquiries can sit side by side without
 * blocking each other (a second inquiry is easily renegotiated), but a
 * Sale is irreversible — the dress leaves inventory for good — so even a
 * mere inquiry is worth surfacing here rather than silently selling out
 * from under it. Product.status already blocks Confirmed/Picked-up dresses
 * from ever reaching the Sale picker (see the sales page's product
 * query) — this check exists for the gap that leaves: an Inquiry-stage
 * booking never touches Product.status at all.
 */
export async function findUpcomingBookingForProduct(
  productId: string
): Promise<UpcomingBooking | null> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const booking = await Booking.findOne({
    "items.product": productId,
    deletedAt: null,
    status: { $nin: ["cancelled", "returned"] },
    rentalEndDate: { $gte: startOfToday },
  })
    .select("bookingNumber billNumber rentalStartDate rentalEndDate status")
    .sort({ rentalStartDate: 1 })
    .lean();

  if (!booking) return null;
  return {
    _id: String(booking._id),
    bookingNumber: booking.bookingNumber,
    billNumber: booking.billNumber,
    rentalStartDate: booking.rentalStartDate,
    rentalEndDate: booking.rentalEndDate,
    status: booking.status,
  };
}
