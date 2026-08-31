import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
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

    const sale = await Sale.findById(id).lean();
    if (!sale) {
      return apiError("Sale not found", 404);
    }

    if (!sale.deletedAt) {
      return apiError("Move this sale to trash before permanently deleting it", 409);
    }

    // Product.status was already released back to "available" (if nothing
    // else still marks it sold) when this sale was first moved to trash, so
    // there's no inventory side effect left to handle here.
    await Sale.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Sale",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: sale as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
