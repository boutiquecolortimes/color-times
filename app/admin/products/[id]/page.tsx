import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "Edit Product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectToDatabase();

  const [product, categories] = await Promise.all([
    Product.findById(id).lean(),
    Category.find().sort({ name: 1 }).select("name").lean(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl">Edit Product</h1>
      <ProductForm
        productId={id}
        categories={categories.map((category) => ({
          _id: String(category._id),
          name: category.name,
        }))}
        defaultValues={{
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          category: String(product.category),
          designer: product.designer ?? "",
          description: product.description,
          color: product.color,
          fabric: product.fabric,
          dressType: product.dressType ?? "",
          work: product.work ?? "",
          images: product.images,
          variants: product.variants,
          status: product.status,
          rentalPricePerDay: product.rentalPricePerDay,
          purchasePrice: product.purchasePrice ?? 0,
          stitchingCost: product.stitchingCost ?? 0,
          transportCost: product.transportCost ?? 0,
          retailValue: product.retailValue,
          securityDeposit: product.securityDeposit,
          isFeatured: product.isFeatured,
          isNewArrival: product.isNewArrival,
          isActive: product.isActive,
          tags: product.tags,
        }}
      />
    </div>
  );
}
