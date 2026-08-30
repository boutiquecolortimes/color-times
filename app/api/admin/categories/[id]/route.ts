import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { categorySchema } from "@/lib/validations/category";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { escapeRegex } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = categorySchema.partial().parse(body);

    await connectToDatabase();

    if (input.name) {
      const existingName = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: `^${escapeRegex(input.name)}$`, $options: "i" },
      }).lean();
      if (existingName) {
        return apiError("A category with this name already exists", 409);
      }
    }

    if (input.slug) {
      const existingSlug = await Category.findOne({ _id: { $ne: id }, slug: input.slug }).lean();
      if (existingSlug) {
        return apiError("A category with this slug already exists", 409);
      }
    }

    const category = await Category.findByIdAndUpdate(id, input, { returnDocument: "after" });

    if (!category) {
      return apiError("Category not found", 404);
    }

    return apiSuccess({ category });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

// Soft delete — moves the category to Trash. Doesn't require the category
// to be unused: like Products, trashing just hides it from the active list;
// only the permanent-delete route (which actually erases the document)
// needs the "no products reference it" check.
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const category = await Category.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );
  if (!category) {
    return apiError("Category not found", 404);
  }

  await recordAuditLog({
    entityType: "Category",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: category.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
