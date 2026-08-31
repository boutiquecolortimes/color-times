import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const bulkSaleActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one sale"),
  action: z.enum(["delete", "restore", "permanent-delete"]),
});

// Same rule as the single-item DELETE route: once a manual sale is trashed,
// put the dress back into rental circulation if nothing else still marks it
// sold.
async function releaseIfUnsold(productId: string, excludeSaleIds: string[]): Promise<void> {
  const stillSold = await Sale.exists({
    product: productId,
    source: "manual",
    deletedAt: null,
    _id: { $nin: excludeSaleIds },
  });
  if (!stillSold) {
    await Product.findByIdAndUpdate(productId, { status: "available" });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkSaleActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete" && !MANAGER_ROLES.includes(auth.user.role)) {
      return apiError("You do not have permission to permanently delete these items", 403);
    }

    if (input.action === "permanent-delete") {
      const sales = await Sale.find({
        _id: { $in: input.ids },
        deletedAt: { $ne: null },
      }).lean();
      if (sales.length === 0) {
        return apiError("No trashed items found among the selected sales", 404);
      }

      // Products were already released back to "available" (where
      // applicable) when these sales were first moved to trash, so there's
      // no inventory side effect left to handle here.
      await Sale.deleteMany({ _id: { $in: sales.map((s) => s._id) } });

      await recordAuditLog({
        entityType: "Sale",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: {
          permanent: true,
          count: sales.length,
          ids: sales.map((s) => String(s._id)),
        },
      });

      return apiSuccess({ deleted: sales.length });
    }

    if (input.action === "restore") {
      // Deliberately doesn't touch Product.status — same reasoning as the
      // single-item restore route.
      const result = await Sale.updateMany(
        { _id: { $in: input.ids }, deletedAt: { $ne: null } },
        { deletedAt: null }
      );

      await recordAuditLog({
        entityType: "Sale",
        entityId: "bulk",
        action: "bulk_update",
        actor: auth.user,
        metadata: { action: "restore", count: result.modifiedCount, ids: input.ids },
      });

      return apiSuccess({ affected: result.modifiedCount });
    }

    // "delete" (soft, move to Trash)
    const sales = await Sale.find({ _id: { $in: input.ids }, deletedAt: null }).lean();
    if (sales.length === 0) {
      return apiSuccess({ affected: 0 });
    }

    await Sale.updateMany(
      { _id: { $in: sales.map((s) => s._id) } },
      { deletedAt: new Date() }
    );

    const trashedIds = sales.map((s) => String(s._id));
    const manualProductIds = [
      ...new Set(
        sales.filter((s) => s.source !== "booking").map((s) => String(s.product))
      ),
    ];
    await Promise.all(
      manualProductIds.map((productId) => releaseIfUnsold(productId, trashedIds))
    );

    await recordAuditLog({
      entityType: "Sale",
      entityId: "bulk",
      action: "bulk_delete",
      actor: auth.user,
      metadata: { count: sales.length, ids: trashedIds },
    });

    return apiSuccess({ affected: sales.length });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
