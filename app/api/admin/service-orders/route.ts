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
import { escapeRegex } from "@/lib/utils";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const all = searchParams.get("all") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const status = searchParams.get("status");
  const serviceType = searchParams.get("serviceType");
  const view = searchParams.get("view") ?? "active";
  const search = searchParams.get("search")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir") === "desc" ? -1 : 1;
  const SORTABLE_FIELDS: Record<string, string> = {
    description: "description",
    totalAmount: "totalAmount",
    sentDate: "sentDate",
    expectedReturnDate: "expectedReturnDate",
    status: "status",
  };
  const sort = sortBy && SORTABLE_FIELDS[sortBy]
    ? { [SORTABLE_FIELDS[sortBy]]: sortDir as 1 | -1 }
    : { createdAt: -1 as const };

  const filter: Record<string, unknown> = view === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };
  if (status && status !== "all") filter.status = status;
  if (serviceType && serviceType !== "all") filter.serviceType = serviceType;
  // Matches by dress name/code, description, or who it's assigned to.
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const matchingProducts = await Product.find({ $or: [{ name: regex }, { sku: regex }] })
      .select("_id")
      .lean();
    filter.$or = [
      { description: regex },
      { assignedTo: regex },
      { product: { $in: matchingProducts.map((p) => p._id) } },
    ];
  }
  // Date range filters against the "sent" date — when the dress went out
  // for cleaning/alteration.
  if (from || to) {
    const sentDateFilter: Record<string, Date> = {};
    if (from) sentDateFilter.$gte = new Date(from);
    if (to) sentDateFilter.$lte = new Date(to);
    filter.sentDate = sentDateFilter;
  }

  const baseQuery = ServiceOrder.find(filter)
    .populate("product", "name images sku")
    .populate("booking", "bookingNumber")
    .sort(sort);

  const [orders, total] = await Promise.all([
    all ? baseQuery.lean() : baseQuery.skip((page - 1) * pageSize).limit(pageSize).lean(),
    ServiceOrder.countDocuments(filter),
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
