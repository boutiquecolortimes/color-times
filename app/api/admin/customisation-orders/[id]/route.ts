import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import {
  customisationOrderUpdateSchema,
  computeCustomisationDue,
} from "@/lib/validations/customisation-order";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const order = await CustomisationOrder.findById(id).lean();
  if (!order) {
    return apiError("Customisation order not found", 404);
  }

  return apiSuccess({ order });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = customisationOrderUpdateSchema.parse(body);

    await connectToDatabase();

    const before = await CustomisationOrder.findById(id).lean();
    if (!before) {
      return apiError("Customisation order not found", 404);
    }

    const update: Record<string, unknown> = {};
    if (input.orderDate !== undefined) update.orderDate = new Date(input.orderDate);
    if (input.customerName !== undefined) update.customerName = input.customerName;
    if (input.customerPhone !== undefined) update.customerPhone = input.customerPhone;
    if (input.customerAddress !== undefined) update.customerAddress = input.customerAddress;
    if (input.customer !== undefined) update.customer = input.customer || null;
    if (input.stitchingType !== undefined) update.stitchingType = input.stitchingType;
    if (input.detail !== undefined) update.detail = input.detail;
    if (input.measurements !== undefined) update.measurements = input.measurements;
    if (input.totalAmount !== undefined) update.totalAmount = input.totalAmount;
    if (input.advancePayment !== undefined) update.advancePayment = input.advancePayment;
    if (input.notes !== undefined) update.notes = input.notes;
    if (input.status !== undefined) update.status = input.status;

    if (input.totalAmount !== undefined || input.advancePayment !== undefined) {
      update.dueAmount = computeCustomisationDue({
        totalAmount: input.totalAmount ?? before.totalAmount,
        advancePayment: input.advancePayment ?? before.advancePayment,
      });
    }

    const order = await CustomisationOrder.findByIdAndUpdate(id, update, {
      returnDocument: "after",
    });
    if (!order) {
      return apiError("Customisation order not found", 404);
    }

    const changes = diffObjects(
      before as unknown as Record<string, unknown>,
      order.toObject() as unknown as Record<string, unknown>
    );

    if (changes.length > 0) {
      await recordAuditLog({
        entityType: "CustomisationOrder",
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

  const order = await CustomisationOrder.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );

  if (!order) {
    return apiError("Customisation order not found", 404);
  }

  await recordAuditLog({
    entityType: "CustomisationOrder",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: order.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
