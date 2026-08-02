import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const product = await Product.findById(id).lean();
    if (!product) {
      return apiError("Product not found", 404);
    }

    if (!product.deletedAt) {
      return apiError("Move this product to trash before permanently deleting it", 409);
    }

    // No reference-integrity guard: the admin can purge a trashed product
    // even if bookings/service orders still point to it. The full document
    // is preserved in the audit log snapshot below, so the record isn't
    // truly lost — it just stops resolving on old bookings/orders (those
    // already render defensively when a populated product comes back null).
    await Product.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Product",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: product as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
