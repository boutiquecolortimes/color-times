import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
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

    // Deliberately doesn't touch Product.status back to "sold" — the dress
    // may have been sold or booked to someone else while this sale sat in
    // Trash, same reasoning as restoring a Booking.
    const sale = await Sale.findByIdAndUpdate(
      id,
      { deletedAt: null },
      { returnDocument: "after" }
    ).populate("product", "name images sku");

    if (!sale) {
      return apiError("Sale not found", 404);
    }

    await recordAuditLog({
      entityType: "Sale",
      entityId: id,
      action: "restore",
      actor: auth.user,
    });

    return apiSuccess({ sale });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
