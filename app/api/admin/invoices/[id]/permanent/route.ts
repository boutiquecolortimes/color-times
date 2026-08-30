import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
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

    const invoice = await Invoice.findById(id).lean();
    if (!invoice) {
      return apiError("Invoice not found", 404);
    }

    if (!invoice.deletedAt) {
      return apiError("Move this invoice to trash before permanently deleting it", 409);
    }

    // Nothing else in the schema references an Invoice by id (unlike
    // Product/Category/Booking), so there's no reference-integrity check
    // needed here beyond requiring it already be trashed.
    await Invoice.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Invoice",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: invoice as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
