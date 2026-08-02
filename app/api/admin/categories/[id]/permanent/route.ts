import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const category = await Category.findById(id).lean();
    if (!category) {
      return apiError("Category not found", 404);
    }

    if (!category.deletedAt) {
      return apiError("Move this category to trash before permanently deleting it", 409);
    }

    // No reference-integrity guard: products left pointing at this category
    // just render "—" for category (already handled with `?.` on the
    // products list), no different from an unassigned product.
    await Category.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Category",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: category as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
