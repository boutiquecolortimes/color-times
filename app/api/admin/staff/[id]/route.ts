import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Staff } from "@/models/Staff";
import { staffMemberSchema } from "@/lib/validations/staff-member";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = staffMemberSchema.partial().parse(body);

    await connectToDatabase();

    const update: Record<string, unknown> = { ...input };
    if (input.joiningDate) update.joiningDate = new Date(input.joiningDate);

    const staff = await Staff.findByIdAndUpdate(id, update, { returnDocument: "after" });
    if (!staff) {
      return apiError("Staff member not found", 404);
    }

    return apiSuccess({ staff });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

// Soft delete — moves the staff member to Trash. Their past salary payment
// history is left untouched (it still references this staff id) so payment
// records and reports keep working even while the person is trashed.
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const staff = await Staff.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );
  if (!staff) {
    return apiError("Staff member not found", 404);
  }

  await recordAuditLog({
    entityType: "Staff",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: staff.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
