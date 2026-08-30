import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { SalaryPayment } from "@/models/SalaryPayment";
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

    const payment = await SalaryPayment.findById(id).lean();
    if (!payment) {
      return apiError("Salary payment not found", 404);
    }

    if (!payment.deletedAt) {
      return apiError("Move this payment to trash before permanently deleting it", 409);
    }

    await SalaryPayment.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "SalaryPayment",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: payment as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
