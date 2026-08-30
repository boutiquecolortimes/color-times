import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const customer = await User.findOneAndUpdate(
      { _id: id, role: "customer" },
      { isActive: false },
      { returnDocument: "after" }
    ).select("name email phone isActive createdAt");

    if (!customer) {
      return apiError("Customer not found", 404);
    }

    await recordAuditLog({
      entityType: "User",
      entityId: id,
      action: "archive",
      actor: auth.user,
    });

    return apiSuccess({ customer });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
