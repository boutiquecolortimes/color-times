import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { categorySchema } from "@/lib/validations/category";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { escapeRegex } from "@/lib/utils";

export async function GET(): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();
  const categories = await Category.find().sort({ displayOrder: 1, name: 1 }).lean();
  return apiSuccess({ categories });
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
