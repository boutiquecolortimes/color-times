import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { categorySchema } from "@/lib/validations/category";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { escapeRegex } from "@/lib/utils";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") ?? "active";
  const filter = status === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const all = searchParams.get("all") === "true";

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .skip(all ? 0 : (page - 1) * pageSize)
      .limit(all ? 0 : pageSize)
      .lean(),
    Category.countDocuments(filter),
  ]);

  return apiSuccess({
    categories,
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
    const input = categorySchema.parse(body);

    await connectToDatabase();

    const existingName = await Category.findOne({
      name: { $regex: `^${escapeRegex(input.name)}$`, $options: "i" },
    }).lean();
    if (existingName) {
      return apiError("A category with this name already exists", 409);
    }

    const existing = await Category.findOne({ slug: input.slug }).lean();
    if (existing) {
      return apiError("A category with this slug already exists", 409);
    }

    const displayOrder = input.displayOrder ?? (await Category.countDocuments());

    const category = await Category.create({
      ...input,
      heroImage: input.heroImage ?? "",
      isFeatured: input.isFeatured ?? false,
      displayOrder,
    });
    return apiSuccess({ category }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
