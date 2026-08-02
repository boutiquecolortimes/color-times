import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { ServiceOrder } from "@/models/ServiceOrder";
import { Product } from "@/models/Product";
import "@/models/Booking";
import { serviceOrderSchema, computeServiceOrderTotal } from "@/lib/validations/service-order";
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
  const serviceType = searchParams.get("serviceType");
  const view = searchParams.get("view") ?? "active";

  const filter: Record<string, unknown> = view === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };
  if (status && status !== "all") filter.status = status;
  if (serviceType && serviceType !== "all") filter.serviceType = serviceType;

  const [orders, total] = await Promise.all([
    ServiceOrder.find(filter)
      .populate("product", "name images sku")
      .populate("booking", "bookingNumber")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ServiceOrder.countDocuments(filter),
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
    const input = serviceOrderSchema.parse(body);

    await connectToDatabase();

    const totalAmount = computeServiceOrderTotal(input);

    const order = await ServiceOrder.create({
      serviceType: input.serviceType,
      product: input.product,
      booking: input.booking || null,
      description: input.description,
      dryCleanCharge: input.dryCleanCharge,
      ironCharge: input.ironCharge,
      stitchingCharge: input.stitchingCharge,
      stitchingType: input.stitchingType,
      otherCharge: input.otherCharge,
      totalAmount,
      assignedTo: input.assignedTo,
      sentDate: new Date(input.sentDate),
      expectedReturnDate: new Date(input.expectedReturnDate),
      notes: input.notes,
      status: "pending",
    });

    await Product.findByIdAndUpdate(input.product, {
      status: input.serviceType === "dry_clean" ? "under_dry_cleaning" : "under_repair",
    });

    await recordAuditLog({
      entityType: "ServiceOrder",
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
