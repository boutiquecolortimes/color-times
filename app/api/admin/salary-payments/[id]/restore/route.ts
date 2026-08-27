import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { SalaryPayment } from "@/models/SalaryPayment";
import "@/models/Staff";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const payment = await SalaryPayment.findByIdAndUpdate(
      id,
      { deletedAt: null },
      { returnDocument: "after" }
    ).populate("staff", "name designation phone");
    if (!payment) {
      return apiError("Salary payment not found", 404);
    }

    await recordAuditLog({
      entityType: "SalaryPayment",
      entityId: id,
      action: "restore",
      actor: auth.user,
    });

    return apiSuccess({ payment });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
