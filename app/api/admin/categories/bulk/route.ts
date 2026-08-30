import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const bulkCategoryActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one category"),
  action: z.enum(["delete", "restore", "permanent-delete"]),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkCategoryActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete" && !MANAGER_ROLES.includes(auth.user.role)) {
      return apiError("You do not have permission to permanently delete these items", 403);
    }

    if (input.action === "permanent-delete") {
      const categories = await Category.find({
        _id: { $in: input.ids },
        deletedAt: { $ne: null },
      }).lean();
      if (categories.length === 0) {
        return apiError("No trashed items found among the selected categories", 404);
      }

      // No reference-integrity guard: products left pointing at a purged
      // category just render "—" for category, no different from an
      // unassigned product.
      await Category.deleteMany({ _id: { $in: categories.map((c) => c._id) } });

      await recordAuditLog({
        entityType: "Category",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: {
          permanent: true,
          count: categories.length,
          ids: categories.map((c) => String(c._id)),
        },
      });

      return apiSuccess({ deleted: categories.length, blocked: [] });
    }

    // "delete" (soft, move to Trash) and "restore" just hide/unhide —
    // neither needs the product-reference check above, same as Products.
    const update = input.action === "delete" ? { deletedAt: new Date() } : { deletedAt: null };
    const result = await Category.updateMany({ _id: { $in: input.ids } }, update);

    await recordAuditLog({
      entityType: "Category",
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
