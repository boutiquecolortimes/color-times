import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { SalaryPayment } from "@/models/SalaryPayment";
import "@/models/Staff";
import { salaryPaymentSchema } from "@/lib/validations/salary-payment";
import { Staff } from "@/models/Staff";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") ?? "active";
  const filter: Record<string, unknown> =
    status === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };

  const staffId = searchParams.get("staff");
  if (staffId) filter.staff = staffId;
  const forMonth = searchParams.get("forMonth");
  if (forMonth) filter.forMonth = forMonth;

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "10")));
  const all = searchParams.get("all") === "true";
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir") === "desc" ? -1 : 1;
  const SORTABLE_FIELDS: Record<string, string> = {
    amount: "amount",
    paymentDate: "paymentDate",
    forMonth: "forMonth",
    createdAt: "createdAt",
  };
  const sort = sortBy && SORTABLE_FIELDS[sortBy]
    ? { [SORTABLE_FIELDS[sortBy]]: sortDir as 1 | -1 }
    : { paymentDate: -1 as const };

  const [payments, total] = await Promise.all([
    SalaryPayment.find(filter)
      .populate("staff", "name designation phone")
      .sort(sort)
      .skip(all ? 0 : (page - 1) * pageSize)
      .limit(all ? 0 : pageSize)
      .lean(),
    SalaryPayment.countDocuments(filter),
  ]);

  return apiSuccess({
    payments,
    pagination: all
      ? { page: 1, pageSize: total || 1, total, totalPages: 1 }
      : { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = salaryPaymentSchema.parse(body);

    await connectToDatabase();

    const staff = await Staff.findById(input.staff).lean();
    if (!staff) {
      return apiError("Selected staff member could not be found", 404);
    }

    const payment = await SalaryPayment.create({
      ...input,
      paymentDate: new Date(input.paymentDate),
      paymentMethod: input.paymentMethod ?? "cash",
    });

    await recordAuditLog({
      entityType: "SalaryPayment",
      entityId: String(payment._id),
      action: "create",
      actor: auth.user,
      snapshot: payment.toObject() as unknown as Record<string, unknown>,
      metadata: { staffName: staff.name },
    });

    const populated = await SalaryPayment.findById(payment._id)
      .populate("staff", "name designation phone")
      .lean();

    return apiSuccess({ payment: populated }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
