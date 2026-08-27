import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Expense } from "@/models/Expense";
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

    const expense = await Expense.findByIdAndUpdate(id, { deletedAt: null }, { returnDocument: "after" });
    if (!expense) {
      return apiError("Expense not found", 404);
    }

    await recordAuditLog({
      entityType: "Expense",
      entityId: id,
      action: "restore",
      actor: auth.user,
    });

    return apiSuccess({ expense });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
