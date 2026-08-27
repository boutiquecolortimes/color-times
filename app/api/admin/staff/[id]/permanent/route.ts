import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Staff } from "@/models/Staff";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const staff = await Staff.findById(id).lean();
    if (!staff) {
      return apiError("Staff member not found", 404);
    }

    if (!staff.deletedAt) {
      return apiError("Move this staff member to trash before permanently deleting them", 409);
    }

    await Staff.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Staff",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: staff as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
