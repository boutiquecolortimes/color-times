import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
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

      // No reference-integrity guard: bookings/service orders left pointing
      // at a purged product already render defensively when the populated
      // product comes back null. Each document's full snapshot lives in the
      // audit log instead.
      await Product.deleteMany({ _id: { $in: products.map((p) => p._id) } });

      await recordAuditLog({
        entityType: "Product",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: { permanent: true, count: products.length, ids: products.map((p) => String(p._id)) },
      });

      return apiSuccess({ deleted: products.length, blocked: [] });
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
