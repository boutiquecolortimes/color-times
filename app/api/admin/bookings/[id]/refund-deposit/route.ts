import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Invoice } from "@/models/Invoice";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

/**
 * Marks a returned booking's remaining security deposit as handed back — for
 * when staff didn't refund it at the Return step itself. Takes it out of
 * "Security Held" and stamps the refund date. The booking's invoice(s) are
 * marked too, so Billing and Bookings never disagree.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const existing = await Booking.findById(id).lean();
    if (!existing) {
      return apiError("Booking not found", 404);
    }
    if (existing.status !== "returned") {
      return apiError("The deposit is refunded once the dress has been returned", 409);
    }
    if ((existing.depositRefundAmount ?? 0) <= 0) {
      return apiError("Nothing to refund — the whole deposit was used for rent or damage", 409);
    }
    if (existing.depositRefunded) {
      return apiError("Deposit has already been refunded", 409);
    }

    const refundedAt = new Date();
    const booking = await Booking.findByIdAndUpdate(
      id,
      { depositRefunded: true, depositRefundedAt: refundedAt },
      { returnDocument: "after" }
    );

    await Invoice.updateMany(
      { booking: existing._id, depositRefunded: false, status: { $ne: "cancelled" } },
      { depositRefunded: true }
    );

    await recordAuditLog({
      entityType: "Booking",
      entityId: id,
      action: "update",
      actor: auth.user,
      changes: [
        { field: "depositRefunded", from: false, to: true },
        { field: "depositRefundedAt", from: null, to: refundedAt },
      ],
    });

    return apiSuccess({ booking });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
