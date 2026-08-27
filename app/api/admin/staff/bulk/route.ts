import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { Staff } from "@/models/Staff";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const bulkStaffActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one staff member"),
  action: z.enum(["delete", "restore", "permanent-delete"]),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkStaffActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete") {
      const staffMembers = await Staff.find({
        _id: { $in: input.ids },
        deletedAt: { $ne: null },
      }).lean();
      if (staffMembers.length === 0) {
        return apiError("No trashed items found among the selected staff", 404);
      }

      await Staff.deleteMany({ _id: { $in: staffMembers.map((s) => s._id) } });

      await recordAuditLog({
        entityType: "Staff",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: {
          permanent: true,
          count: staffMembers.length,
          ids: staffMembers.map((s) => String(s._id)),
        },
      });

      return apiSuccess({ deleted: staffMembers.length, blocked: [] });
    }

    const update = input.action === "delete" ? { deletedAt: new Date() } : { deletedAt: null };
    const result = await Staff.updateMany({ _id: { $in: input.ids } }, update);

    await recordAuditLog({
      entityType: "Staff",
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
