import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Expense } from "@/models/Expense";
import { expenseSchema } from "@/lib/validations/expense";
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
    const input = expenseSchema.partial().parse(body);

    await connectToDatabase();

    const update: Record<string, unknown> = { ...input };
    if (input.expenseDate) update.expenseDate = new Date(input.expenseDate);

    const expense = await Expense.findByIdAndUpdate(id, update, { returnDocument: "after" });
    if (!expense) {
      return apiError("Expense not found", 404);
    }

    return apiSuccess({ expense });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const expense = await Expense.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );
  if (!expense) {
    return apiError("Expense not found", 404);
  }

  await recordAuditLog({
    entityType: "Expense",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: expense.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
