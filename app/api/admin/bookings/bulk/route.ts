import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/admin/booking-availability";
import { requireApiRole } from "@/lib/api/require-role";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { bulkActionSchema } from "@/lib/validations/bulk-action";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete") {
      const bookings = await Booking.find({
        _id: { $in: input.ids },
        deletedAt: { $ne: null },
      }).lean();
      if (bookings.length === 0) {
        return apiError("No trashed items found among the selected bookings", 404);
      }

      // No reference-integrity guard: invoices/service orders left pointing
      // at a purged booking already render defensively when the populated
      // booking comes back null.
      await Booking.deleteMany({ _id: { $in: bookings.map((b) => b._id) } });

      // Belt-and-suspenders release of dress holds, same as the
      // single-item route — a trashed booking should already have
      // released its holds, but double-check here too.
      for (const booking of bookings) {
        if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) continue;
        for (const item of booking.items) {
          const stillActive = await Booking.exists({
            "items.product": item.product,
            status: { $in: ACTIVE_BOOKING_STATUSES },
            deletedAt: null,
          });
          if (!stillActive) {
            await Product.findByIdAndUpdate(item.product, { status: "available" });
          }
        }
      }

      await recordAuditLog({
        entityType: "Booking",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: {
          permanent: true,
          count: bookings.length,
          ids: bookings.map((b) => String(b._id)),
        },
      });

      return apiSuccess({ deleted: bookings.length, blocked: [] });
    }

    // "delete" (soft, move to Trash) and "restore" just hide/unhide — no
    // reference check needed, same as Categories/Customers/Invoices.
    const update = input.action === "delete" ? { deletedAt: new Date() } : { deletedAt: null };
    const result = await Booking.updateMany({ _id: { $in: input.ids } }, update);

    await recordAuditLog({
      entityType: "Booking",
      entityId: "bulk",
      action: input.action === "delete" ? "bulk_delete" : "bulk_update",
      actor: auth.user,
      metadata: { action: input.action, count: result.modifiedCount, ids: input.ids },
    });

    return apiSuccess({ affected: result.modifiedCount });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
