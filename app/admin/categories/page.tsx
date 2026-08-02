import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { CategoriesClient } from "@/components/admin/categories-client";

export const metadata: Metadata = { title: "Categories" };

const PAGE_SIZE = 5;

export default async function AdminCategoriesPage() {
  await connectToDatabase();

  const [categories, total] = await Promise.all([
    Category.find({ deletedAt: null })
      .sort({ displayOrder: 1, name: 1 })
      .limit(PAGE_SIZE)
      .lean(),
    Category.countDocuments({ deletedAt: null }),
  ]);

  const initialCategories = categories.map((category) => ({
    _id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description,
    heroImage: category.heroImage,
    displayOrder: category.displayOrder,
    isFeatured: category.isFeatured,
  }));

  return (
    <CategoriesClient
      initialCategories={initialCategories}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      }}
    />
  );
}
