import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { SalaryPayment } from "@/models/SalaryPayment";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const bulkSalaryPaymentActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one payment"),
  action: z.enum(["delete", "restore", "permanent-delete"]),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkSalaryPaymentActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete" && !MANAGER_ROLES.includes(auth.user.role)) {
      return apiError("You do not have permission to permanently delete these items", 403);
    }

    if (input.action === "permanent-delete") {
      const payments = await SalaryPayment.find({
        _id: { $in: input.ids },
        deletedAt: { $ne: null },
      }).lean();
      if (payments.length === 0) {
        return apiError("No trashed items found among the selected payments", 404);
      }

      await SalaryPayment.deleteMany({ _id: { $in: payments.map((p) => p._id) } });

      await recordAuditLog({
        entityType: "SalaryPayment",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: {
          permanent: true,
          count: payments.length,
          ids: payments.map((p) => String(p._id)),
        },
      });

      return apiSuccess({ deleted: payments.length, blocked: [] });
    }

    const update = input.action === "delete" ? { deletedAt: new Date() } : { deletedAt: null };
    const result = await SalaryPayment.updateMany({ _id: { $in: input.ids } }, update);

    await recordAuditLog({
      entityType: "SalaryPayment",
      entityId: "bulk",
      action: input.action === "delete" ? "bulk_delete" : "bulk_update",
      actor: auth.user,
      metadata: { action: input.action, count: result.modifiedCount, ids: input.ids },
    });

    return apiSuccess({ affected: result.modifiedCount });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
