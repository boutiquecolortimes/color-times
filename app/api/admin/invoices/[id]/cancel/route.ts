import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
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

    const existing = await Invoice.findById(id).lean();
    if (!existing) {
      return apiError("Invoice not found", 404);
    }
    if (existing.status === "cancelled") {
      return apiError("Invoice is already cancelled", 409);
    }

    // Cancelling a Paid invoice pulls it out of revenue reporting, so it
    // needs a manager-level account, not just any staff login — same bar as
    // permanently deleting a record. Cancelling anything else (draft, sent,
    // partially paid, overdue) stays open to any admin-role user, as before.
    if (existing.status === "paid" && !MANAGER_ROLES.includes(auth.user.role)) {
      return apiError("You do not have permission to cancel a paid invoice", 403);
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { status: "cancelled" },
      { returnDocument: "after" }
    );

    await recordAuditLog({
      entityType: "Invoice",
      entityId: id,
      action: "status_change",
      actor: auth.user,
      changes: [{ field: "status", from: existing.status, to: "cancelled" }],
      metadata: existing.status === "paid" ? { cancelledFromPaid: true } : undefined,
    });

    return apiSuccess({ invoice });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
