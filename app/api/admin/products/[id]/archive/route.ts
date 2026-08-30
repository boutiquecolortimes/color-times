import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { requireApiRole } from "@/lib/api/require-role";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const product = await Product.findByIdAndUpdate(
      id,
      { archivedAt: new Date() },
      { returnDocument: "after" }
    );

    if (!product) {
      return apiError("Product not found", 404);
    }

    await recordAuditLog({
      entityType: "Product",
      entityId: id,
      action: "archive",
      actor: auth.user,
    });

    return apiSuccess({ product });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
