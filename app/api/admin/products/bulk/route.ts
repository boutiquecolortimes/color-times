import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { Booking } from "@/models/Booking";
import { ServiceOrder } from "@/models/ServiceOrder";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { bulkActionSchema } from "@/lib/validations/bulk-action";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const UPDATE_BY_ACTION: Record<string, Record<string, unknown> | null> = {
  archive: { archivedAt: new Date() },
  restore: { archivedAt: null, deletedAt: null },
  delete: { deletedAt: new Date() },
  activate: { isActive: true },
  deactivate: { isActive: false },
};

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete") {
      const products = await Product.find({ _id: { $in: input.ids }, deletedAt: { $ne: null } })
        .lean();
      if (products.length === 0) {
        return apiError("No trashed items found among the selected products", 404);
      }

      // Same protection as the single-item permanent delete: don't erase a
      // product's name/code out from under booking or service-order history
      // that still points to it. One aggregate covers every selected
      // product instead of a query per row.
      const productIds = products.map((p) => p._id);
      const [bookingCounts, serviceOrderCounts] = await Promise.all([
        Booking.aggregate([
          { $match: { "items.product": { $in: productIds } } },
          { $unwind: "$items" },
          { $match: { "items.product": { $in: productIds } } },
          { $group: { _id: "$items.product", count: { $sum: 1 } } },
        ]),
        ServiceOrder.aggregate([
          { $match: { product: { $in: productIds } } },
          { $group: { _id: "$product", count: { $sum: 1 } } },
        ]),
      ]);
      const bookingCountById = new Map<string, number>(
        bookingCounts.map((row) => [String(row._id), row.count as number])
      );
      const serviceOrderCountById = new Map<string, number>(
        serviceOrderCounts.map((row) => [String(row._id), row.count as number])
      );
      const hasHistory = (id: string) =>
        (bookingCountById.get(id) ?? 0) > 0 || (serviceOrderCountById.get(id) ?? 0) > 0;

      const deletable = products.filter((p) => !hasHistory(String(p._id)));
      const blocked = products
        .filter((p) => hasHistory(String(p._id)))
        .map((p) => ({ name: p.name, sku: p.sku }));

      if (deletable.length > 0) {
        await Product.deleteMany({ _id: { $in: deletable.map((p) => p._id) } });

        await recordAuditLog({
          entityType: "Product",
          entityId: "bulk",
          action: "bulk_delete",
          actor: auth.user,
          metadata: { permanent: true, count: deletable.length, ids: deletable.map((p) => String(p._id)) },
        });
      }

      return apiSuccess({ deleted: deletable.length, blocked });
    }

    const update = UPDATE_BY_ACTION[input.action];
    if (!update) {
      return apiError("Unsupported bulk action", 400);
    }

    const result = await Product.updateMany({ _id: { $in: input.ids } }, update);

    await recordAuditLog({
      entityType: "Product",
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
