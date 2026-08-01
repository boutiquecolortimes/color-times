import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
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

    if (input.action === "permanent-delete") {
      const categories = await Category.find({
        _id: { $in: input.ids },
        deletedAt: { $ne: null },
      }).lean();
      if (categories.length === 0) {
        return apiError("No trashed items found among the selected categories", 404);
      }

      // Categories are the only thing products reference by id, and
      // bookings only ever reference products — so blocking on "any
      // product still in this category" is sufficient to protect the
      // whole chain, no separate booking check needed. One aggregate
      // covers every selected category instead of a query per row.
      const categoryIds = categories.map((c) => c._id);
      const productCounts = await Product.aggregate([
        { $match: { category: { $in: categoryIds } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]);
      const countByCategory = new Map<string, number>(
        productCounts.map((row) => [String(row._id), row.count as number])
      );

      const deletable = categories.filter((c) => !countByCategory.has(String(c._id)));
      const blocked = categories
        .filter((c) => countByCategory.has(String(c._id)))
        .map((c) => ({ name: c.name, productCount: countByCategory.get(String(c._id)) ?? 0 }));

      if (deletable.length > 0) {
        await Category.deleteMany({ _id: { $in: deletable.map((c) => c._id) } });

        await recordAuditLog({
          entityType: "Category",
          entityId: "bulk",
          action: "bulk_delete",
          actor: auth.user,
          metadata: {
            permanent: true,
            count: deletable.length,
            ids: deletable.map((c) => String(c._id)),
          },
        });
      }

      return apiSuccess({ deleted: deletable.length, blocked });
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
