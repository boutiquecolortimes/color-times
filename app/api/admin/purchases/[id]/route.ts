import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/models/Purchase";
import { purchaseSchema } from "@/lib/validations/purchase";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Editing a purchase never touches Product stock again — only creating one
// with "add to stock" checked does that (see the POST route). This keeps a
// later correction (fixing a typo'd cost, say) from silently re-adjusting
// inventory a second time.
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = purchaseSchema.partial().parse(body);

    await connectToDatabase();

    const before = await Purchase.findById(id).lean();
    if (!before) {
      return apiError("Purchase not found", 404);
    }

    const quantity = input.quantity ?? before.quantity;
    const unitCost = input.unitCost ?? before.unitCost;

    const update: Record<string, unknown> = {
      ...input,
      totalCost: quantity * unitCost,
    };
    if (input.purchaseDate) update.purchaseDate = new Date(input.purchaseDate);
    delete update.product;
    delete update.addToStock;

    const purchase = await Purchase.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("product", "name sku");
    if (!purchase) {
      return apiError("Purchase not found", 404);
    }

    return apiSuccess({ purchase });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const purchase = await Purchase.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );
  if (!purchase) {
    return apiError("Purchase not found", 404);
  }

  await recordAuditLog({
    entityType: "Purchase",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: purchase.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
