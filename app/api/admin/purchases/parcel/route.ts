import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/models/Purchase";
import { Product } from "@/models/Product";
import "@/models/Category";
import { purchaseParcelSchema, type PurchaseParcelInput } from "@/lib/validations/purchase";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { slugify } from "@/lib/utils";

// One dealer bill, many dresses. Each line item still becomes its own
// Purchase document (see models/Purchase.ts for why), sharing the same
// billNumber so the Purchases list can group them back together. A line can
// either restock a dress already in the catalog, or hand over just enough to
// create a brand-new draft dress on the spot — photos and final rental
// pricing are finished later on that product's own page, same as an empty
// Quick Add elsewhere in Products.
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input: PurchaseParcelInput = purchaseParcelSchema.parse(body);

    await connectToDatabase();

    const purchaseDate = new Date(input.purchaseDate);
    const paymentStatus = input.paymentStatus ?? "paid";

    const lineTotals = input.items.map((item) => item.quantity * item.unitCost);
    const billTotal = lineTotals.reduce((sum, value) => sum + value, 0);
    const billAmountPaid = input.amountPaid ?? (paymentStatus === "pending" ? 0 : billTotal);

    const createdPurchaseIds: string[] = [];
    let productsCreated = 0;
    let remainingAmountPaid = billAmountPaid;

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const lineTotal = lineTotals[i];
      const isLast = i === input.items.length - 1;
      // Split the bill-level "amount paid" across lines proportionally to
      // each line's share of the bill — the dealer was paid against the
      // whole bill, not line by line, but the Purchases list still shows one
      // row per dress. The last line soaks up any rounding remainder.
      const lineAmountPaid = isLast
        ? Math.max(0, Math.min(lineTotal, Math.round(remainingAmountPaid)))
        : Math.max(0, Math.min(lineTotal, Math.round(billTotal > 0 ? (lineTotal / billTotal) * billAmountPaid : 0)));
      remainingAmountPaid -= lineAmountPaid;

      let productId: string | null = null;
      let itemName: string;
      let addedToStock = false;

      if (item.mode === "existing") {
        if (!item.product) {
          return apiError(`Select a dress for line ${i + 1}`, 400);
        }
        const product = await Product.findById(item.product);
        if (!product) {
          return apiError(`Selected dress could not be found for line ${i + 1}`, 404);
        }
        productId = String(product._id);
        itemName = product.name;

        const size = item.variantSize?.trim() || "Custom";
        const variant = product.variants.find(
          (v) => v.size.trim().toLowerCase() === size.toLowerCase()
        );
        if (variant) {
          variant.quantityInStock += item.quantity;
        } else {
          product.variants.push({ size, quantityInStock: item.quantity });
        }
        await product.save();
        addedToStock = true;

        await recordAuditLog({
          entityType: "Product",
          entityId: productId,
          action: "update",
          actor: auth.user,
          changes: [
            {
              field: "variants",
              from: null,
              to: `+${item.quantity} (${size}) restocked from bill ${input.billNumber}`,
            },
          ],
        });
      } else {
        const name = (item.name || "").trim();
        if (!name) {
          return apiError(`Enter a name for line ${i + 1}`, 400);
        }
        if (!item.category) {
          return apiError(`Choose a category for line ${i + 1}`, 400);
        }

        const baseSlug = slugify(name) || `dress-${Date.now()}-${i}`;
        let slug = baseSlug;
        let slugSuffix = 1;
        while (await Product.exists({ slug })) {
          slug = `${baseSlug}-${slugSuffix}`;
          slugSuffix += 1;
        }

        const skuBase = (item.sku?.trim() || slug.toUpperCase()).slice(0, 40);
        let sku = skuBase;
        let skuSuffix = 1;
        while (await Product.exists({ sku })) {
          sku = `${skuBase}-${skuSuffix}`.slice(0, 40);
          skuSuffix += 1;
        }

        // Retail value and security deposit aren't collected on this quick
        // entry — auto-derive them the same way the Products form does, so
        // booking deposits and invoices keep working once this draft is
        // finished and made active.
        const rentalPricePerDay = item.rentalPricePerDay ?? 0;
        const retailValue = Math.round(rentalPricePerDay * 12);
        const securityDeposit = Math.round(rentalPricePerDay * 2);

        const product = await Product.create({
          name,
          slug,
          sku,
          category: item.category,
          color: item.color || "",
          fabric: item.fabric || "",
          images: ["/logo.png"],
          variants: [{ size: item.variantSize?.trim() || "Custom", quantityInStock: item.quantity }],
          rentalPricePerDay,
          retailValue,
          securityDeposit,
          purchasePrice: item.unitCost,
          // Hidden from booking/sale pickers and the storefront until an
          // admin finishes it with real photos and pricing — the same
          // "draft, finish later" state a bare-minimum Quick Add product
          // would land in.
          isActive: false,
          isNewArrival: true,
        });
        productId = String(product._id);
        itemName = product.name;
        addedToStock = true;
        productsCreated += 1;

        await recordAuditLog({
          entityType: "Product",
          entityId: productId,
          action: "create",
          actor: auth.user,
          snapshot: product.toObject() as unknown as Record<string, unknown>,
          metadata: { source: "purchase-parcel", billNumber: input.billNumber },
        });
      }

      const purchase = await Purchase.create({
        billNumber: input.billNumber,
        itemName,
        vendorName: input.vendorName,
        vendorContact: input.vendorContact || undefined,
        product: productId,
        variantSize: item.variantSize || undefined,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: lineTotal,
        purchaseDate,
        paymentStatus,
        amountPaid: lineAmountPaid,
        addedToStock,
        notes: input.notes || undefined,
      });
      createdPurchaseIds.push(String(purchase._id));

      await recordAuditLog({
        entityType: "Purchase",
        entityId: String(purchase._id),
        action: "create",
        actor: auth.user,
        snapshot: purchase.toObject() as unknown as Record<string, unknown>,
      });
    }

    return apiSuccess(
      {
        billNumber: input.billNumber,
        purchaseCount: createdPurchaseIds.length,
        productsCreated,
      },
      201
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
