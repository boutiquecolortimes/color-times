import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/models/Purchase";
import { Product } from "@/models/Product";
import { purchaseSchema } from "@/lib/validations/purchase";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

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
    billNumber: "billNumber",
    itemName: "itemName",
    vendorName: "vendorName",
    quantity: "quantity",
    totalCost: "totalCost",
    purchaseDate: "purchaseDate",
    paymentStatus: "paymentStatus",
    createdAt: "createdAt",
    deletedAt: "deletedAt",
  };
  const sort = sortBy && SORTABLE_FIELDS[sortBy]
    ? { [SORTABLE_FIELDS[sortBy]]: sortDir as 1 | -1 }
    : { purchaseDate: -1 as const };

  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .populate("product", "name sku")
      .sort(sort)
      .skip(all ? 0 : (page - 1) * pageSize)
      .limit(all ? 0 : pageSize)
      .lean(),
    Purchase.countDocuments(filter),
  ]);

  return apiSuccess({
    purchases,
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
    const input = purchaseSchema.parse(body);

    await connectToDatabase();

    const totalCost = input.quantity * input.unitCost;
    let addedToStock = false;
    let productId: string | null = null;

    // Optionally bump an existing dress's stock right when the purchase is
    // recorded — only on create; editing a purchase afterward never
    // re-touches stock (same principle as a booking edit not re-running its
    // settlement math), so correcting a typo later doesn't silently double
    // up inventory.
    if (input.product) {
      const product = await Product.findById(input.product);
      if (!product) {
        return apiError("Selected dress could not be found", 404);
      }
      productId = String(product._id);

      if (input.addToStock) {
        const size = input.variantSize?.trim() || "Custom";
        const variant = product.variants.find(
          (v) => v.size.trim().toLowerCase() === size.toLowerCase()
        );
        if (variant) {
          variant.quantityInStock += input.quantity;
        } else {
          product.variants.push({ size, quantityInStock: input.quantity });
        }
        await product.save();
        addedToStock = true;
      }
    }

    const purchase = await Purchase.create({
      itemName: input.itemName,
      vendorName: input.vendorName,
      vendorContact: input.vendorContact || undefined,
      product: productId,
      variantSize: input.variantSize || undefined,
      quantity: input.quantity,
      unitCost: input.unitCost,
      totalCost,
      purchaseDate: new Date(input.purchaseDate),
      paymentStatus: input.paymentStatus ?? "paid",
      amountPaid: input.amountPaid ?? (input.paymentStatus === "pending" ? 0 : totalCost),
      addedToStock,
      notes: input.notes || undefined,
    });

    await recordAuditLog({
      entityType: "Purchase",
      entityId: String(purchase._id),
      action: "create",
      actor: auth.user,
      snapshot: purchase.toObject() as unknown as Record<string, unknown>,
    });

    const populated = await Purchase.findById(purchase._id).populate("product", "name sku").lean();

    return apiSuccess({ purchase: populated }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
