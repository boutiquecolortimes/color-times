import "server-only";
import { Booking } from "@/models/Booking";

export interface BookingsSummary {
  totalAmount: number;
  securityDeposit: number;
  advancePaid: number;
  dueAmount: number;
}

/**
 * Summary tiles on the Bookings page (Total Earnings / Security Held /
 * Advance Collected / Due Amount). Shared by the page's first render and the
 * list API so both always show the same numbers.
 */
export async function getBookingsSummary(filter: Record<string, unknown>): Promise<BookingsSummary> {
  const [row] = await Booking.aggregate([
    {
      $match: {
        ...filter,
        // An inquiry (or legacy pending_payment) booking isn't earnings
        // until the customer actually pays — leave it out of the summary
        // tiles until an advance is recorded. Once any payment is in, it
        // counts like any other booking.
        $nor: [
          {
            status: { $in: ["inquiry", "pending_payment"] },
            $or: [{ advancePaid: { $exists: false } }, { advancePaid: { $lte: 0 } }],
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$totalAmount" },
        securityDeposit: { $sum: "$securityDeposit" },
        advancePaid: { $sum: "$advancePaid" },
        // Same rule as bookingRemainingDue(): rent − paid, and for a
        // returned booking also minus the deposit kept toward rent/damage.
        dueAmount: {
          $sum: {
            $max: [
              0,
              {
                $cond: [
                  { $eq: ["$status", "returned"] },
                  {
                    $subtract: [
                      {
                        $add: [
                          { $subtract: ["$totalAmount", "$securityDeposit"] },
                          { $ifNull: ["$damageCharges", 0] },
                        ],
                      },
                      {
                        $add: [
                          { $ifNull: ["$advancePaid", 0] },
                          {
                            $max: [
                              0,
                              {
                                $subtract: [
                                  "$securityDeposit",
                                  { $ifNull: ["$depositRefundAmount", 0] },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    $subtract: [
                      { $subtract: ["$totalAmount", "$securityDeposit"] },
                      { $ifNull: ["$advancePaid", 0] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    },
  ]);
  return {
    totalAmount: row?.totalAmount ?? 0,
    securityDeposit: row?.securityDeposit ?? 0,
    advancePaid: row?.advancePaid ?? 0,
    dueAmount: row?.dueAmount ?? 0,
  };
}
