import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import {
  customisationOrderSchema,
  computeCustomisationDue,
} from "@/lib/validations/customisation-order";
import { generateCustomisationBillNumber } from "@/lib/admin/customisation-number";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const status = searchParams.get("status");
  const view = searchParams.get("view") ?? "active";

  const filter: Record<string, unknown> =
    view === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };
  if (status && status !== "all") filter.status = status;

  const [orders, total] = await Promise.all([
    CustomisationOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    CustomisationOrder.countDocuments(filter),
  ]);

  return apiSuccess({
    orders,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = customisationOrderSchema.parse(body);

    await connectToDatabase();

    const billNumber = await generateCustomisationBillNumber();
    const dueAmount = computeCustomisationDue(input);

    const order = await CustomisationOrder.create({
      billNumber,
      orderDate: new Date(input.orderDate),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      stitchingType: input.stitchingType,
      detail: input.detail,
      measurements: input.measurements ?? {},
      totalAmount: input.totalAmount,
      advancePayment: input.advancePayment,
      dueAmount,
      notes: input.notes,
      status: "pending",
    });

    await recordAuditLog({
      entityType: "CustomisationOrder",
      entityId: String(order._id),
      action: "create",
      actor: auth.user,
      snapshot: order.toObject() as unknown as Record<string, unknown>,
    });

    return apiSuccess({ order }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
