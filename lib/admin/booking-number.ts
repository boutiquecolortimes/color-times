import "server-only";
import { Booking } from "@/models/Booking";

export async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CTB-${year}-`;
  const latest = await Booking.findOne({ bookingNumber: { $regex: `^${prefix}` } })
    .sort({ bookingNumber: -1 })
    .select("bookingNumber")
    .lean();
  const lastSeq = latest ? Number(latest.bookingNumber.split("-").pop()) : 1000;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 1000) + 1;
  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}

/**
 * Suggests the next manual bill number for the New Booking form — the
 * client is bulk-importing ~880 historical bookings with bill numbers up to
 * 880, so every new booking created going forward must continue from 881
 * without colliding, regardless of what's already been imported. Always
 * returns at least "881" even before any historical data exists.
 */
export async function suggestNextBillNumber(): Promise<string> {
  const FIRST_NEW_BILL_NUMBER = 881;
  const result = await Booking.aggregate<{ max: number }>([
    { $match: { billNumber: { $exists: true, $ne: "" } } },
    {
      $addFields: {
        billNumberAsInt: {
          $convert: { input: "$billNumber", to: "int", onError: null, onNull: null },
        },
      },
    },
    { $match: { billNumberAsInt: { $ne: null } } },
    { $group: { _id: null, max: { $max: "$billNumberAsInt" } } },
  ]);
  const highestSeen = result[0]?.max ?? 0;
  return String(Math.max(highestSeen + 1, FIRST_NEW_BILL_NUMBER));
}
