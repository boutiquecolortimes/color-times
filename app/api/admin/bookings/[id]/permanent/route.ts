import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/admin/booking-availability";
import { requireApiRole } from "@/lib/api/require-role";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const booking = await Booking.findById(id).lean();
    if (!booking) {
      return apiError("Booking not found", 404);
    }

    if (!booking.deletedAt) {
      return apiError("Move this booking to trash before permanently deleting it", 409);
    }

    // No reference-integrity guard: invoices/service orders left pointing at
    // this booking already render defensively when the populated booking
    // comes back null. The full document is preserved in the audit log
    // snapshot below.
    await Booking.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Booking",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: booking as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    // Belt-and-suspenders: the booking should already have released its
    // dress holds when it was first trashed, but double-check here too.
    const productIds = booking.items.map((item) => item.product);
    if (ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      for (const productId of productIds) {
        const stillActive = await Booking.exists({
          "items.product": productId,
          status: { $in: ACTIVE_BOOKING_STATUSES },
          deletedAt: null,
        });
        if (!stillActive) {
          await Product.findByIdAndUpdate(productId, { status: "available" });
        }
      }
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
