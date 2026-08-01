import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { Booking } from "@/models/Booking";
import { ServiceOrder } from "@/models/ServiceOrder";
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

    // Erasing the product document would silently blank out its name/code on
    // every booking and dry-clean/repair order that ever referenced it,
    // wiping that history out of the earnings & expense numbers those
    // records feed into. Only allow a true purge when there's no history to
    // lose (e.g. a duplicate/typo product created and trashed right away).
    const [bookingCount, serviceOrderCount] = await Promise.all([
      Booking.countDocuments({ "items.product": id }),
      ServiceOrder.countDocuments({ product: id }),
    ]);
    if (bookingCount > 0 || serviceOrderCount > 0) {
      return apiError(
        `Cannot permanently delete — this dress has ${bookingCount} booking(s) and ${serviceOrderCount} service order(s) in its history, and deleting it would erase that from your records. Leave it in Trash instead — it stays out of every list but keeps the history intact.`,
        409
      );
    }

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
