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
  const all = searchParams.get("all") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const status = searchParams.get("status");
  const view = searchParams.get("view") ?? "active";
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir") === "desc" ? -1 : 1;
  const SORTABLE_FIELDS: Record<string, string> = {
    billNumber: "billNumber",
    customerName: "customerName",
    totalAmount: "totalAmount",
    dueAmount: "dueAmount",
    orderDate: "orderDate",
    status: "status",
    stitchingType: "stitchingType",
    advancePayment: "advancePayment",
  };
  const sort = sortBy && SORTABLE_FIELDS[sortBy]
    ? { [SORTABLE_FIELDS[sortBy]]: sortDir as 1 | -1 }
    : { createdAt: -1 as const };

  const filter: Record<string, unknown> =
    view === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };
  if (status && status !== "all") filter.status = status;

  const baseQuery = CustomisationOrder.find(filter).sort(sort);

  const [orders, total] = await Promise.all([
    all ? baseQuery.lean() : baseQuery.skip((page - 1) * pageSize).limit(pageSize).lean(),
    CustomisationOrder.countDocuments(filter),
  ]);

  return apiSuccess({
    orders,
    pagination: all
      ? { page: 1, pageSize: total || 1, total, totalPages: 1 }
      : { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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
