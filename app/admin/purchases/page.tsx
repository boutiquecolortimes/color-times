import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/models/Purchase";
import "@/models/Product";
import { PurchasesClient } from "@/components/admin/purchases-client";

export const metadata: Metadata = { title: "Purchases" };

const PAGE_SIZE = 10;

export default async function AdminPurchasesPage() {
  await connectToDatabase();

  const [purchases, total] = await Promise.all([
    Purchase.find({ deletedAt: null })
      .populate("product", "name sku")
      .sort({ purchaseDate: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    Purchase.countDocuments({ deletedAt: null }),
  ]);

  const initialPurchases = purchases.map((purchase) => ({
    _id: String(purchase._id),
    itemName: purchase.itemName,
    vendorName: purchase.vendorName,
    vendorContact: purchase.vendorContact ?? "",
    product: purchase.product
      ? {
          _id: String((purchase.product as unknown as { _id: unknown })._id),
          name: (purchase.product as unknown as { name: string }).name,
          sku: (purchase.product as unknown as { sku: string }).sku,
        }
      : null,
    variantSize: purchase.variantSize ?? "",
    quantity: purchase.quantity,
    unitCost: purchase.unitCost,
    totalCost: purchase.totalCost,
    purchaseDate: purchase.purchaseDate.toISOString().slice(0, 10),
    paymentStatus: purchase.paymentStatus,
    amountPaid: purchase.amountPaid,
    addedToStock: purchase.addedToStock,
    notes: purchase.notes ?? "",
  }));

  return (
    <PurchasesClient
      initialPurchases={initialPurchases}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      }}
    />
  );
}
