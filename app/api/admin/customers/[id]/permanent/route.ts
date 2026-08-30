import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
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

    const customer = await User.findOne({ _id: id, role: "customer" }).lean();
    if (!customer) {
      return apiError("Customer not found", 404);
    }

    if (!customer.deletedAt) {
      return apiError("Move this customer to trash before permanently deleting it", 409);
    }

    // No reference-integrity guard: bookings/invoices/reviews left pointing
    // at this customer already render defensively when the populated
    // customer comes back null. The full document is preserved in the audit
    // log snapshot below.
    await User.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Customer",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: customer as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
