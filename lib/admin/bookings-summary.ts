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
 * Advance Collected / Due Amount). Earnings exclude the security deposit;
 * Advance Collected is only the pre-pickup advance on open bookings. Shared by the page's first render and the
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
        // "Total Earnings" = money the boutique actually earns, never the
        // security deposit (that's refundable — it lives in "Security Held").
        //   cancelled — the advance kept (no-refund policy)
        //   returned  — rent + damage charges (unpaid rent/damage is taken
        //               from the deposit, so that part is earned too)
        //   otherwise — the rent on the booking
        totalAmount: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "cancelled"] }, then: { $max: [0, { $ifNull: ["$advancePaid", 0] }] } },
                {
                  case: { $eq: ["$status", "returned"] },
                  then: {
                    $add: [
                      { $max: [0, { $subtract: ["$totalAmount", "$securityDeposit"] }] },
                      { $ifNull: ["$damageCharges", 0] },
                    ],
                  },
                },
              ],
              default: { $max: [0, { $subtract: ["$totalAmount", "$securityDeposit"] }] },
            },
          },
        },
        // "Security Held" = deposit money still physically with the store —
        // not every deposit ever recorded. Same rule as bookingDepositHeld()
        // in lib/admin/booking-status.ts.
        securityDeposit: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "cancelled"] }, then: 0 },
                {
                  case: { $eq: ["$status", "returned"] },
                  then: {
                    $cond: [
                      { $eq: [{ $ifNull: ["$depositRefunded", false] }, true] },
                      0,
                      { $max: [0, { $ifNull: ["$depositRefundAmount", 0] }] },
                    ],
                  },
                },
              ],
              default: {
                $min: [
                  "$securityDeposit",
                  {
                    $max: [
                      0,
                      {
                        $subtract: [
                          { $ifNull: ["$advancePaid", 0] },
                          { $max: [0, { $subtract: ["$totalAmount", "$securityDeposit"] }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        // "Advance Collected" = advance taken before pickup on bookings that
        // are still open. advancePaid is the running total of everything
        // paid, so the pickup payment (pickupPaid, the "Due Paid" column) is
        // taken off. Once a booking is Returned or Cancelled its advance is
        // settled into earnings and no longer counts here.
        advancePaid: {
          $sum: {
            $cond: [
              { $in: ["$status", ["returned", "cancelled"]] },
              0,
              {
                $max: [
                  0,
                  { $subtract: [{ $ifNull: ["$advancePaid", 0] }, { $ifNull: ["$pickupPaid", 0] }] },
                ],
              },
            ],
          },
        },
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
