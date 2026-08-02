import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { requireApiRole } from "@/lib/api/require-role";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    // Deliberately doesn't touch the dress's Product.status — the dress may
    // have been rebooked to someone else while this booking sat in Trash.
    // The item picker already flags date conflicts, so an admin restoring a
    // booking sees any clash immediately rather than this silently
    // re-locking a dress that's no longer actually free.
    const booking = await Booking.findByIdAndUpdate(
      id,
      { deletedAt: null },
      { returnDocument: "after" }
    );

    if (!booking) {
      return apiError("Booking not found", 404);
    }

    await recordAuditLog({
      entityType: "Booking",
      entityId: id,
      action: "restore",
      actor: auth.user,
    });

    return apiSuccess({ booking });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
