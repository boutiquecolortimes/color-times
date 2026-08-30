import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { ServiceOrder } from "@/models/ServiceOrder";
import { Product } from "@/models/Product";
import "@/models/Booking";
import { serviceOrderUpdateSchema, computeServiceOrderTotal } from "@/lib/validations/service-order";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import { notifyAccounts } from "@/lib/notifications/in-app";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const order = await ServiceOrder.findById(id)
    .populate("product", "name images sku")
    .populate("booking", "bookingNumber")
    .lean();

  if (!order) {
    return apiError("Service order not found", 404);
  }

  return apiSuccess({ order });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = serviceOrderUpdateSchema.parse(body);

    await connectToDatabase();

    const before = await ServiceOrder.findById(id).lean();
    if (!before) {
      return apiError("Service order not found", 404);
    }

    const update: Record<string, unknown> = {};
    if (input.serviceType !== undefined) update.serviceType = input.serviceType;
    if (input.product !== undefined) update.product = input.product;
    if (input.booking !== undefined) update.booking = input.booking || null;
    if (input.bookingBillNumberRef !== undefined) {
      update.bookingBillNumberRef = input.bookingBillNumberRef;
    }
    if (input.description !== undefined) update.description = input.description;
    if (input.dryCleanCharge !== undefined) update.dryCleanCharge = input.dryCleanCharge;
    if (input.ironCharge !== undefined) update.ironCharge = input.ironCharge;
    if (input.stitchingCharge !== undefined) update.stitchingCharge = input.stitchingCharge;
    if (input.stitchingType !== undefined) update.stitchingType = input.stitchingType;
    if (input.otherCharge !== undefined) update.otherCharge = input.otherCharge;
    if (input.assignedTo !== undefined) update.assignedTo = input.assignedTo;
    if (input.sentDate !== undefined) update.sentDate = new Date(input.sentDate);
    if (input.expectedReturnDate !== undefined) {
      update.expectedReturnDate = new Date(input.expectedReturnDate);
    }
    if (input.notes !== undefined) update.notes = input.notes;
    if (input.status !== undefined) {
      update.status = input.status;
      update.completedDate = input.status === "completed" ? new Date() : before.completedDate;
    }

    const hasChargeChange =
      input.dryCleanCharge !== undefined ||
      input.ironCharge !== undefined ||
      input.stitchingCharge !== undefined ||
      input.otherCharge !== undefined ||
      input.serviceType !== undefined;
    if (hasChargeChange) {
      update.totalAmount = computeServiceOrderTotal({
        serviceType: (input.serviceType ?? before.serviceType) as "dry_clean" | "tailor",
        dryCleanCharge: input.dryCleanCharge ?? before.dryCleanCharge,
        ironCharge: input.ironCharge ?? before.ironCharge,
        stitchingCharge: input.stitchingCharge ?? before.stitchingCharge,
        otherCharge: input.otherCharge ?? before.otherCharge,
      });
    }

    const order = await ServiceOrder.findByIdAndUpdate(id, update, { returnDocument: "after" });
    if (!order) {
      return apiError("Service order not found", 404);
    }

    if (input.status === "completed" || input.status === "cancelled") {
      const product = await Product.findByIdAndUpdate(order.product, { status: "available" });
      if (input.status === "completed") {
        void notifyAccounts(ADMIN_ROLES, {
          type: "service_ready",
          title: "Ready for pickup",
          message: `${product?.name ?? "Dress"} — ${order.serviceType === "dry_clean" ? "dry cleaning" : "tailoring"} complete`,
          link: `/admin/services`,
          relatedEntityType: "ServiceOrder",
          relatedEntityId: id,
        });
      }
    }

    const changes = diffObjects(
      before as unknown as Record<string, unknown>,
      order.toObject() as unknown as Record<string, unknown>
    );

    if (changes.length > 0) {
      await recordAuditLog({
        entityType: "ServiceOrder",
        entityId: id,
        action: input.status !== undefined ? "status_change" : "update",
        actor: auth.user,
        changes,
      });
    }

    return apiSuccess({ order });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const order = await ServiceOrder.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );

  if (!order) {
    return apiError("Service order not found", 404);
  }

  await recordAuditLog({
    entityType: "ServiceOrder",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: order.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
