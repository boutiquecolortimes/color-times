import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import "@/models/Category";
import { Settings } from "@/models/Settings";
import { productSchema } from "@/lib/validations/product";
import { DEFAULT_INVENTORY_SETTINGS } from "@/lib/validations/inventory-settings";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import { notifyAccounts } from "@/lib/notifications/in-app";
import type { InventorySettingsInput } from "@/lib/validations/inventory-settings";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const product = await Product.findById(id).populate("category", "name slug").lean();
  if (!product) {
    return apiError("Product not found", 404);
  }

  return apiSuccess({ product });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = productSchema.partial().parse(body);

    // If the form submitted an empty array (all images/sizes were cleared),
    // don't let the save wipe the product down to nothing — keep the
    // existing entries instead. A field the client never touched at all
    // stays absent from `input` and is left alone below either way.
    if (input.images && input.images.length === 0) delete input.images;
    if (input.variants && input.variants.length === 0) delete input.variants;

    await connectToDatabase();

    const before = await Product.findById(id).lean();
    if (!before) {
      return apiError("Product not found", 404);
    }

    let product = await Product.findByIdAndUpdate(id, input, { returnDocument: "after" });
    if (!product) {
      return apiError("Product not found", 404);
    }

    // Auto-archive products that have gone out of stock, and warn the team on low stock.
    if (input.variants) {
      const totalStock = product.variants.reduce((sum, v) => sum + v.quantityInStock, 0);
      const inventorySettingsDoc = await Settings.findOne({ module: "inventory" }).lean();
      const inventorySettings =
        (inventorySettingsDoc?.data as InventorySettingsInput | undefined) ?? DEFAULT_INVENTORY_SETTINGS;

      if (totalStock === 0 && !product.archivedAt && inventorySettings.autoArchiveOutOfStock) {
        product =
          (await Product.findByIdAndUpdate(
            id,
            { archivedAt: new Date() },
            { returnDocument: "after" }
          )) ?? product;
      }

      const previousStock = before.variants.reduce((sum, v) => sum + v.quantityInStock, 0);
      if (
        totalStock <= inventorySettings.lowStockThreshold &&
        previousStock > inventorySettings.lowStockThreshold
      ) {
        void notifyAccounts(ADMIN_ROLES, {
          type: "low_stock",
          title: "Low stock alert",
          message: `${product.name} — only ${totalStock} unit${totalStock === 1 ? "" : "s"} left`,
          link: `/admin/products/${id}`,
          relatedEntityType: "Product",
          relatedEntityId: id,
        });
      }
    }

    const changes = diffObjects(
      before as unknown as Record<string, unknown>,
      product.toObject() as unknown as Record<string, unknown>
    );

    if (changes.length > 0) {
      await recordAuditLog({
        entityType: "Product",
        entityId: id,
        action: "update",
        actor: auth.user,
        changes,
      });
    }

    return apiSuccess({ product });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const product = await Product.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );

  if (!product) {
    return apiError("Product not found", 404);
  }

  await recordAuditLog({
    entityType: "Product",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: product.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
