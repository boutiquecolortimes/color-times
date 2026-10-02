import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { ServiceOrder } from "@/models/ServiceOrder";
import { requireApiRole } from "@/lib/api/require-role";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const undoReturnSchema = z.object({
  reason: z.string().trim().min(3, "Please give a reason").max(500),
});

// Undo a Return marked by mistake: the booking goes back to Picked Up and
// everything the return changed is rolled back —
//   • return condition / notes, damage charges, deposit refund and the
//     settlement figures are cleared
//   • dry-clean / tailor orders auto-created at return (still pending) are
//     cancelled, and the dresses go back to "picked up"
// What was undone is kept in the booking's Activity history, with the
// reason. The caller then re-syncs the invoice (from-booking, undoReturn).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const { reason } = undoReturnSchema.parse(await request.json());
    await connectToDatabase();

    const before = await Booking.findById(id).lean();
    if (!before || before.deletedAt) return apiError("Booking not found", 404);
    if (before.status !== "returned") {
      return apiError("Only a returned booking can have its return undone", 409);
    }

    const productIds = before.items.map((item) => item.product);

    // A dress from this booking may have gone out again on another booking
    // since it came back — don't pull it back onto this one.
    const clash = await Booking.findOne({
      _id: { $ne: before._id },
      deletedAt: null,
      status: "in_use",
      "items.product": { $in: productIds },
    })
      .select("bookingNumber")
      .lean();
    if (clash) {
      return apiError(
        `Can't undo: a dress from this booking is now picked up on booking ${clash.bookingNumber}.`,
        409
      );
    }

    // Service orders created automatically at this return and not started yet.
    const autoServiceOrders = await ServiceOrder.find({
      booking: before._id,
      status: "pending",
      deletedAt: null,
      createdAt: { $gte: before.returnedAt ?? before.updatedAt },
    })
      .select("_id")
      .lean();

    const booking = await Booking.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "in_use",
          returnedAt: null,
          settledAt: null,
          dryCleaningRequired: false,
          stitchingRequired: false,
          damageCharges: 0,
          depositRefunded: false,
          depositRefundAmount: 0,
        },
        $unset: {
          returnCondition: "",
          returnNotes: "",
          pendingRentAmount: "",
          finalSettlementAmount: "",
        },
      },
      { returnDocument: "after" }
    );
    if (!booking) return apiError("Booking not found", 404);

    if (autoServiceOrders.length > 0) {
      await ServiceOrder.updateMany(
        { _id: { $in: autoServiceOrders.map((order) => order._id) } },
        { status: "cancelled" }
      );
    }
    await Product.updateMany({ _id: { $in: productIds } }, { status: "picked_up" });

    await recordAuditLog({
      entityType: "Booking",
      entityId: id,
      action: "status_change",
      actor: auth.user,
      changes: [
        { field: "status", from: "returned", to: "in_use" },
        { field: "damageCharges", from: before.damageCharges ?? 0, to: 0 },
        { field: "depositRefundAmount", from: before.depositRefundAmount ?? 0, to: 0 },
      ],
      metadata: {
        undoReturn: true,
        reason,
        // Snapshot of the return that was undone, for the record.
        undoneReturn: {
          returnedAt: before.returnedAt,
          returnCondition: before.returnCondition,
          returnNotes: before.returnNotes,
          damageCharges: before.damageCharges,
          pendingRentAmount: before.pendingRentAmount,
          depositRefunded: before.depositRefunded,
          depositRefundAmount: before.depositRefundAmount,
          finalSettlementAmount: before.finalSettlementAmount,
        },
        cancelledServiceOrders: autoServiceOrders.map((order) => String(order._id)),
      },
    });

    return apiSuccess({ booking, cancelledServiceOrders: autoServiceOrders.length });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
