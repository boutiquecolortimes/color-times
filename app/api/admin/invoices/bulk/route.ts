import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const bulkInvoiceActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one invoice"),
  action: z.enum(["delete", "restore", "permanent-delete"]),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkInvoiceActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete") {
      // Nothing else references an Invoice by id, so the only guard here
      // is that it must already be trashed — same as the single-item route.
      const invoices = await Invoice.find({
        _id: { $in: input.ids },
        deletedAt: { $ne: null },
      }).lean();
      if (invoices.length === 0) {
        return apiError("No trashed items found among the selected invoices", 404);
      }

      await Invoice.deleteMany({ _id: { $in: invoices.map((i) => i._id) } });

      await recordAuditLog({
        entityType: "Invoice",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: {
          permanent: true,
          count: invoices.length,
          ids: invoices.map((i) => String(i._id)),
        },
      });

      return apiSuccess({ deleted: invoices.length, blocked: [] });
    }

    if (input.action === "restore") {
      const result = await Invoice.updateMany(
        { _id: { $in: input.ids }, deletedAt: { $ne: null } },
        { deletedAt: null }
      );

      await recordAuditLog({
        entityType: "Invoice",
        entityId: "bulk",
        action: "bulk_update",
        actor: auth.user,
        metadata: { action: "restore", count: result.modifiedCount, ids: input.ids },
      });

      return apiSuccess({ affected: result.modifiedCount });
    }

    // "delete" (soft, move to Trash) — only draft/cancelled invoices are
    // eligible, same rule as the single-item DELETE route. Split into
    // deletable/blocked and report both instead of failing the whole
    // batch on the first ineligible invoice.
    const candidates = await Invoice.find({ _id: { $in: input.ids }, deletedAt: null })
      .select("invoiceNumber status")
      .lean();

    const deletable = candidates.filter((inv) => inv.status === "draft" || inv.status === "cancelled");
    const blocked = candidates
      .filter((inv) => inv.status !== "draft" && inv.status !== "cancelled")
      .map((inv) => ({ invoiceNumber: inv.invoiceNumber, status: inv.status }));

    if (deletable.length > 0) {
      await Invoice.updateMany(
        { _id: { $in: deletable.map((inv) => inv._id) } },
        { deletedAt: new Date() }
      );

      await recordAuditLog({
        entityType: "Invoice",
        entityId: "bulk",
        action: "bulk_delete",
        actor: auth.user,
        metadata: { count: deletable.length, ids: deletable.map((inv) => String(inv._id)) },
      });
    }

    return apiSuccess({ deleted: deletable.length, blocked });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
