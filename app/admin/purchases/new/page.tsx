import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { PurchaseParcelForm } from "@/components/admin/purchase-parcel-form";

export const metadata: Metadata = { title: "New Purchase" };

export default async function NewPurchasePage() {
  await connectToDatabase();

  const [categories, products] = await Promise.all([
    Category.find().sort({ name: 1 }).select("name").lean(),
    Product.find({ deletedAt: null, isActive: true })
      .sort({ name: 1 })
      .select("name sku variants")
      .lean(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">New Purchase</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter one dealer bill and every dress it covers — restock dresses already in the catalog, or
          create brand-new ones on the spot.
        </p>
      </div>
      <PurchaseParcelForm
        categories={categories.map((category) => ({
          _id: String(category._id),
          name: category.name,
        }))}
        products={products.map((product) => ({
          _id: String(product._id),
          name: product.name,
          sku: product.sku,
          variants: product.variants.map((variant) => ({
            size: variant.size,
            quantityInStock: variant.quantityInStock,
          })),
        }))}
      />
    </div>
  );
}
