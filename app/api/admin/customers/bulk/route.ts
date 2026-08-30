import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const bulkCustomerActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one customer"),
  action: z.enum(["delete", "restore", "permanent-delete"]),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkCustomerActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete" && !MANAGER_ROLES.includes(auth.user.role)) {
      return apiError("You do not have permission to permanently delete these items", 403);
    }

    if (input.action === "permanent-delete") {
      const customers = await User.find({
        _id: { $in: input.ids },
        role: "customer",
        deletedAt: { $ne: null },
      }).lean();
      if (customers.length === 0) {
        return apiError("No trashed items found among the selected customers", 404);
      }

      // No reference-integrity guard: bookings/invoices/reviews left
      // pointing at a purged customer already render defensively when the
      // populated customer comes back null.
      await User.deleteMany({ _id: { $in: customers.map((c) => c._id) } });

      await recordAuditLog({
        entityType: "Customer",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: {
          permanent: true,
          count: customers.length,
          ids: customers.map((c) => String(c._id)),
        },
      });

      return apiSuccess({ deleted: customers.length, blocked: [] });
    }

    // "delete" (soft, move to Trash) and "restore" just toggle deletedAt +
    // isActive — no reference check needed, same as Categories/Bookings.
    const update =
      input.action === "delete"
        ? { deletedAt: new Date(), isActive: false }
        : { deletedAt: null, isActive: true };
    const result = await User.updateMany(
      { _id: { $in: input.ids }, role: "customer" },
      update
    );

    await recordAuditLog({
      entityType: "Customer",
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
