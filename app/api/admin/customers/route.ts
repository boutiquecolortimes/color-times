import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { customerCreateSchema } from "@/lib/validations/customer";
import { hashPassword } from "@/lib/auth/password";
import { generateTemporaryPassword } from "@/lib/auth/generate-password";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const all = searchParams.get("all") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const search = searchParams.get("search")?.trim();
  const view = searchParams.get("view") === "trash" ? "trash" : "active";
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir") === "desc" ? -1 : 1;
  const SORTABLE_FIELDS: Record<string, string> = {
    name: "name",
    email: "email",
    phone: "phone",
    createdAt: "createdAt",
  };
  const sort = sortBy && SORTABLE_FIELDS[sortBy]
    ? { [SORTABLE_FIELDS[sortBy]]: sortDir as 1 | -1 }
    : { createdAt: -1 as const };

  const filter: Record<string, unknown> = {
    role: "customer",
    deletedAt: view === "trash" ? { $ne: null } : null,
  };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const baseQuery = User.find(filter).select("name email phone createdAt").sort(sort);

  const [customers, total] = await Promise.all([
    all ? baseQuery.lean() : baseQuery.skip((page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(filter),
  ]);

  return apiSuccess({
    customers,
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
    const input = customerCreateSchema.parse(body);

    await connectToDatabase();

    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) {
      return apiError("An account with this email already exists", 409);
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const addresses =
      input.addressLine1 && input.addressCity && input.addressState && input.addressPostalCode
        ? [
            {
              label: "Primary",
              line1: input.addressLine1,
              city: input.addressCity,
              state: input.addressState,
              postalCode: input.addressPostalCode,
              isDefault: true,
            },
          ]
        : [];

    const customer = await User.create({
      name: input.name,
      email: input.email,
      phone: input.phone || undefined,
      fatherName: input.fatherName || undefined,
      passwordHash,
      role: "customer",
      isEmailVerified: true,
      isActive: true,
      addresses,
    });

    await recordAuditLog({
      entityType: "User",
      entityId: customer._id,
      action: "create",
      actor: auth.user,
      metadata: { name: customer.name, email: customer.email, role: "customer" },
    });

    return apiSuccess(
      {
        customer: {
          _id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          fatherName: customer.fatherName,
          createdAt: customer.createdAt,
        },
      },
      201
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
