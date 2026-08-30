import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/models/Purchase";
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

    const purchase = await Purchase.findById(id).lean();
    if (!purchase) {
      return apiError("Purchase not found", 404);
    }

    if (!purchase.deletedAt) {
      return apiError("Move this purchase to trash before permanently deleting it", 409);
    }

    await Purchase.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Purchase",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: purchase as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
