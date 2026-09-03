import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { saleUpdateSchema } from "@/lib/validations/sale";
import { findUpcomingBookingForProduct } from "@/lib/admin/booking-availability";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Puts a dress back into rental circulation once nothing else still marks
// it sold — used when a manual sale is re-pointed at a different product or
// removed entirely.
async function releaseIfUnsold(productId: string, excludeSaleId: string): Promise<void> {
  const stillSold = await Sale.exists({
    product: productId,
    source: "manual",
    deletedAt: null,
    _id: { $ne: excludeSaleId },
  });
  if (!stillSold) {
    await Product.findByIdAndUpdate(productId, { status: "available" });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const sale = await Sale.findById(id).populate("product", "name images sku").lean();
  if (!sale) {
    return apiError("Sale not found", 404);
  }

  return apiSuccess({ sale });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = saleUpdateSchema.parse(body);

    await connectToDatabase();

    const before = await Sale.findById(id).lean();
    if (!before) {
      return apiError("Sale not found", 404);
    }

    // Same check as creating a new sale — only relevant when the product on
    // this manual sale is actually being changed to something else.
    if (
      before.source !== "booking" &&
      input.product !== undefined &&
      String(input.product) !== String(before.product)
    ) {
      const conflict = await findUpcomingBookingForProduct(input.product);
      if (conflict) {
        return apiError(
          `This dress already has a booking (${conflict.bookingNumber}) from ${conflict.rentalStartDate.toDateString()} to ${conflict.rentalEndDate.toDateString()} — cancel that booking first before selling this dress outright`,
          409
        );
      }
    }

    const update: Record<string, unknown> = {};
    if (input.saleDate !== undefined) update.saleDate = new Date(input.saleDate);
    if (input.customerName !== undefined) update.customerName = input.customerName;
    if (input.customerPhone !== undefined) update.customerPhone = input.customerPhone;
    if (input.customerAddress !== undefined) update.customerAddress = input.customerAddress;
    if (input.customer !== undefined) update.customer = input.customer || null;
    if (input.product !== undefined) update.product = input.product;
    if (input.details !== undefined) update.details = input.details;
    if (input.totalAmount !== undefined) update.totalAmount = input.totalAmount;

    const sale = await Sale.findByIdAndUpdate(id, update, { returnDocument: "after" });
    if (!sale) {
      return apiError("Sale not found", 404);
    }

    // Keep dress inventory status in sync if the product on this sale
    // changed — only for manual sales; booking-sourced Sale records are
    // just a revenue ledger entry and don't drive product status.
    if (
      before.source !== "booking" &&
      input.product !== undefined &&
      String(input.product) !== String(before.product)
    ) {
      await Product.findByIdAndUpdate(input.product, { status: "sold" });
      await releaseIfUnsold(String(before.product), id);
    }

    const changes = diffObjects(
      before as unknown as Record<string, unknown>,
      sale.toObject() as unknown as Record<string, unknown>
    );

    if (changes.length > 0) {
      await recordAuditLog({
        entityType: "Sale",
        entityId: id,
        action: "update",
        actor: auth.user,
        changes,
      });
    }

    return apiSuccess({ sale });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const before = await Sale.findById(id).lean();
  if (!before) {
    return apiError("Sale not found", 404);
  }

  const sale = await Sale.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );

  if (!sale) {
    return apiError("Sale not found", 404);
  }

  if (before.source !== "booking") {
    await releaseIfUnsold(String(before.product), id);
  }

  await recordAuditLog({
    entityType: "Sale",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: sale.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
