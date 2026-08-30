import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { SalaryPayment } from "@/models/SalaryPayment";
import "@/models/Staff";
import { salaryPaymentSchema } from "@/lib/validations/salary-payment";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = salaryPaymentSchema.partial().parse(body);

    await connectToDatabase();

    const update: Record<string, unknown> = { ...input };
    if (input.paymentDate) update.paymentDate = new Date(input.paymentDate);

    const payment = await SalaryPayment.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("staff", "name designation phone");
    if (!payment) {
      return apiError("Salary payment not found", 404);
    }

    return apiSuccess({ payment });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const payment = await SalaryPayment.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );
  if (!payment) {
    return apiError("Salary payment not found", 404);
  }

  await recordAuditLog({
    entityType: "SalaryPayment",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: payment.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
