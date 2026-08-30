import type { Model } from "mongoose";
import { Booking } from "@/models/Booking";
import { Sale } from "@/models/Sale";
import { CustomisationOrder } from "@/models/CustomisationOrder";

// Booking, Sale, and Customisation Order bill numbers now share a single
// continuously-incrementing sequence — a booking gets #00881, whichever of
// the three is created next (a sale, a customisation order, another
// booking...) gets #00882, and so on in actual creation order.
//
// This is a live "highest plain-numeric billNumber seen across all three
// collections, plus one" read rather than an atomic counter, because
// Booking's billNumber has to stay staff-editable: the client is mid-way
// through bulk-importing historical bookings and needs to be able to type a
// specific past bill number during that backfill (see the note in
// lib/admin/booking-number.ts). An atomic shared counter would fight that.
//
// Old prefixed bill numbers from before this change (Sale's "SAL-00001",
// CustomisationOrder's "CO-00001") fail the numeric conversion below and
// are excluded from the max automatically, so existing records are left
// exactly as they are — only records created from now on draw from the
// shared sequence.
//
// The one deliberate exception: the Sale record auto-created as a
// bookkeeping duplicate when a booking is settled (Sale.source === "booking",
// see models/Sale.ts) is not a real new transaction at the counter, so it
// keeps drawing from Sale's own standalone generator
// (generateSaleBillNumber() in lib/admin/sale-number.ts) instead of this
// shared one — otherwise settling a booking would silently burn a number
// out of the shared sequence with no corresponding bill handed to anyone.

const FIRST_SHARED_BILL_NUMBER = 881;

async function highestNumericBillNumber(model: Model<any>): Promise<number> {
  const result = await model.aggregate<{ max: number }>([
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
  return result[0]?.max ?? 0;
}

export async function nextSharedBillNumber(): Promise<string> {
  const [bookingMax, saleMax, customisationMax] = await Promise.all([
    highestNumericBillNumber(Booking),
    highestNumericBillNumber(Sale),
    highestNumericBillNumber(CustomisationOrder),
  ]);
  const highestSeen = Math.max(bookingMax, saleMax, customisationMax);
  const next = Math.max(highestSeen + 1, FIRST_SHARED_BILL_NUMBER);
  return String(next).padStart(5, "0");
}
