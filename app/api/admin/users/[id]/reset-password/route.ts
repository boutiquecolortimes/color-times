import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { STAFF_ROLES } from "@/lib/validations/staff";
import { hashPassword } from "@/lib/auth/password";
import { generateTemporaryPassword } from "@/lib/auth/generate-password";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const user = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } }).select(
      "+tokenVersion"
    );
    if (!user) {
      return apiError("Staff account not found", 404);
    }

    const temporaryPassword = generateTemporaryPassword();
    user.passwordHash = await hashPassword(temporaryPassword);
    // Forces that staff member's existing sessions (any device, any
    // browser) to re-login with the new password on their next refresh.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await recordAuditLog({
      entityType: "User",
      entityId: id,
      action: "update",
      actor: auth.user,
      changes: [{ field: "passwordHash", from: "(reset by admin)", to: "(new password issued)" }],
    });

    return apiSuccess({ temporaryPassword });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
