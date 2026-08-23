import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { ProductsClient } from "@/components/admin/products-client";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 5;

export default async function AdminProductsPage() {
  const currentUser = await getCurrentUser();
  const canManageSettings = Boolean(currentUser && SETTINGS_ROLES.includes(currentUser.role));

  await connectToDatabase();

  const activeFilter = { deletedAt: null, archivedAt: null };

  const [products, total, categories] = await Promise.all([
    Product.find(activeFilter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    Product.countDocuments(activeFilter),
    Category.find().sort({ name: 1 }).select("name slug").lean(),
  ]);

  const initialProducts = products.map((product) => ({
    _id: String(product._id),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    images: product.images,
    category: product.category
      ? {
          _id: String((product.category as unknown as { _id: unknown })._id),
          name: (product.category as unknown as { name: string }).name,
        }
      : null,
    rentalPricePerDay: product.rentalPricePerDay,
    status: product.status,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isFavorited: product.isFavorited,
    tags: product.tags,
    variants: product.variants,
    createdAt: product.createdAt.toISOString(),
    archivedAt: product.archivedAt ? product.archivedAt.toISOString() : null,
    deletedAt: product.deletedAt ? product.deletedAt.toISOString() : null,
  }));

  return (
    <ProductsClient
      initialProducts={initialProducts}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
      categories={categories.map((category) => ({
        _id: String(category._id),
        name: category.name,
        slug: category.slug,
      }))}
      canManageSettings={canManageSettings}
    />
  );
}
