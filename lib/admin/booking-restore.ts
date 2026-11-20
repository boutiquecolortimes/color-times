import "server-only";
import { Booking } from "@/models/Booking";

/**
 * Trashed bookings whose bill number is now used by a live booking (staff
 * re-created the booking while the old one sat in Trash). Restoring them
 * would leave two live bookings with one bill number, so the restore routes
 * refuse and say which booking holds the number.
 */
export async function findRestoreBillClashes(
  ids: string[]
): Promise<{ bookingNumber: string; billNumber: string; usedBy: string }[]> {
  const trashed = await Booking.find({ _id: { $in: ids }, deletedAt: { $ne: null } })
    .select("bookingNumber billNumber")
    .lean();
  const withBill = trashed.filter((b) => b.billNumber);
  if (withBill.length === 0) return [];

  const live = await Booking.find({
    billNumber: { $in: withBill.map((b) => b.billNumber) },
    deletedAt: null,
    _id: { $nin: ids },
  })
    .select("bookingNumber billNumber")
    .lean();
  const usedBy = new Map(live.map((b) => [b.billNumber, b.bookingNumber]));

  const clashes: { bookingNumber: string; billNumber: string; usedBy: string }[] = [];
  const seen = new Map<string, string>();
  for (const b of withBill) {
    const holder = usedBy.get(b.billNumber) ?? seen.get(b.billNumber);
    if (holder) clashes.push({ bookingNumber: b.bookingNumber, billNumber: b.billNumber, usedBy: holder });
    // Two trashed bookings with the same bill number can't both come back.
    else seen.set(b.billNumber, b.bookingNumber);
  }
  return clashes;
}

export function restoreClashMessage(clashes: { bookingNumber: string; billNumber: string; usedBy: string }[]): string {
  return (
    clashes
      .map((c) => `${c.bookingNumber} can't be restored: bill number ${c.billNumber} is now used by booking ${c.usedBy}.`)
      .join(" ") + " Change that booking's bill number first, or delete this one permanently."
  );
}
