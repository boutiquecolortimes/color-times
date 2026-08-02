import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { Invoice } from "@/models/Invoice";
import { ServiceOrder } from "@/models/ServiceOrder";
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

      // Same protection as the single-item permanent delete: don't erase a
      // booking that an invoice or service order still traces back to. One
      // pair of aggregates covers every selected booking instead of a query
      // per row.
      const bookingIds = bookings.map((b) => b._id);
      const [invoiceCounts, serviceOrderCounts] = await Promise.all([
        Invoice.aggregate([
          { $match: { booking: { $in: bookingIds } } },
          { $group: { _id: "$booking", count: { $sum: 1 } } },
        ]),
        ServiceOrder.aggregate([
          { $match: { booking: { $in: bookingIds } } },
          { $group: { _id: "$booking", count: { $sum: 1 } } },
        ]),
      ]);
      const invoiceCountById = new Map<string, number>(
        invoiceCounts.map((row) => [String(row._id), row.count as number])
      );
      const serviceOrderCountById = new Map<string, number>(
        serviceOrderCounts.map((row) => [String(row._id), row.count as number])
      );
      const hasHistory = (id: string) =>
        (invoiceCountById.get(id) ?? 0) > 0 || (serviceOrderCountById.get(id) ?? 0) > 0;

      const deletable = bookings.filter((b) => !hasHistory(String(b._id)));
      const blocked = bookings
        .filter((b) => hasHistory(String(b._id)))
        .map((b) => ({
          bookingNumber: b.bookingNumber,
          invoiceCount: invoiceCountById.get(String(b._id)) ?? 0,
          serviceOrderCount: serviceOrderCountById.get(String(b._id)) ?? 0,
        }));

      if (deletable.length > 0) {
        await Booking.deleteMany({ _id: { $in: deletable.map((b) => b._id) } });

        // Belt-and-suspenders release of dress holds, same as the
        // single-item route — a trashed booking should already have
        // released its holds, but double-check here too.
        for (const booking of deletable) {
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
            count: deletable.length,
            ids: deletable.map((b) => String(b._id)),
          },
        });
      }

      return apiSuccess({ deleted: deletable.length, blocked });
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
