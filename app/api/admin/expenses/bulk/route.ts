import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { Expense } from "@/models/Expense";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const bulkExpenseActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one expense"),
  action: z.enum(["delete", "restore", "permanent-delete"]),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkExpenseActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete") {
      const expenses = await Expense.find({
        _id: { $in: input.ids },
        deletedAt: { $ne: null },
      }).lean();
      if (expenses.length === 0) {
        return apiError("No trashed items found among the selected expenses", 404);
      }

      await Expense.deleteMany({ _id: { $in: expenses.map((e) => e._id) } });

      await recordAuditLog({
        entityType: "Expense",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: {
          permanent: true,
          count: expenses.length,
          ids: expenses.map((e) => String(e._id)),
        },
      });

      return apiSuccess({ deleted: expenses.length, blocked: [] });
    }

    const update = input.action === "delete" ? { deletedAt: new Date() } : { deletedAt: null };
    const result = await Expense.updateMany({ _id: { $in: input.ids } }, update);

    await recordAuditLog({
      entityType: "Expense",
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
