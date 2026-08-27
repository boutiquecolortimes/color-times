import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Expense } from "@/models/Expense";
import { expenseSchema } from "@/lib/validations/expense";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") ?? "active";
  const filter: Record<string, unknown> =
    status === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };

  const category = searchParams.get("category");
  if (category) filter.category = category;

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "10")));
  const all = searchParams.get("all") === "true";
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir") === "desc" ? -1 : 1;
  const SORTABLE_FIELDS: Record<string, string> = {
    description: "description",
    category: "category",
    amount: "amount",
    expenseDate: "expenseDate",
    createdAt: "createdAt",
  };
  const sort = sortBy && SORTABLE_FIELDS[sortBy]
    ? { [SORTABLE_FIELDS[sortBy]]: sortDir as 1 | -1 }
    : { expenseDate: -1 as const };

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort(sort)
      .skip(all ? 0 : (page - 1) * pageSize)
      .limit(all ? 0 : pageSize)
      .lean(),
    Expense.countDocuments(filter),
  ]);

  return apiSuccess({
    expenses,
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
    const input = expenseSchema.parse(body);

    await connectToDatabase();

    const expense = await Expense.create({
      ...input,
      expenseDate: new Date(input.expenseDate),
      paymentMethod: input.paymentMethod || undefined,
      notes: input.notes || undefined,
    });
    return apiSuccess({ expense }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
