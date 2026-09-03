import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
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

    const existing = await Invoice.findById(id).lean();
    if (!existing) {
      return apiError("Invoice not found", 404);
    }
    // The deposit is held and returned independently of the rent balance —
    // requiring the whole invoice to be "paid" first left a genuinely
    // already-returned deposit with no way to be marked as such whenever
    // anything else (rent, damage charges) was still outstanding.
    if (existing.status === "cancelled") {
      return apiError("Deposit can't be refunded on a cancelled invoice", 409);
    }
    if (existing.securityDeposit <= 0) {
      return apiError("This invoice has no security deposit to refund", 409);
    }
    if (existing.depositRefunded) {
      return apiError("Deposit has already been refunded", 409);
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { depositRefunded: true },
      { returnDocument: "after" }
    );

    await recordAuditLog({
      entityType: "Invoice",
      entityId: id,
      action: "update",
      actor: auth.user,
      changes: [{ field: "depositRefunded", from: false, to: true }],
    });

    return apiSuccess({ invoice });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
