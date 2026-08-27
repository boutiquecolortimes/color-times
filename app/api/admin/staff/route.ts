import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Staff } from "@/models/Staff";
import { staffMemberSchema } from "@/lib/validations/staff-member";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") ?? "active";
  const filter = status === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "10")));
  const all = searchParams.get("all") === "true";
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir") === "desc" ? -1 : 1;
  const SORTABLE_FIELDS: Record<string, string> = {
    name: "name",
    monthlySalary: "monthlySalary",
    joiningDate: "joiningDate",
    createdAt: "createdAt",
  };
  const sort = sortBy && SORTABLE_FIELDS[sortBy]
    ? { [SORTABLE_FIELDS[sortBy]]: sortDir as 1 | -1 }
    : { name: 1 as const };

  const [staff, total] = await Promise.all([
    Staff.find(filter)
      .sort(sort)
      .skip(all ? 0 : (page - 1) * pageSize)
      .limit(all ? 0 : pageSize)
      .lean(),
    Staff.countDocuments(filter),
  ]);

  return apiSuccess({
    staff,
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
    const input = staffMemberSchema.parse(body);

    await connectToDatabase();

    const staff = await Staff.create({
      ...input,
      joiningDate: new Date(input.joiningDate),
      isActive: input.isActive ?? true,
    });
    return apiSuccess({ staff }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
