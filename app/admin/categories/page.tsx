import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { CategoriesClient } from "@/components/admin/categories-client";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await connectToDatabase();
  const categories = await Category.find({ deletedAt: null })
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  const initialCategories = categories.map((category) => ({
    _id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description,
    heroImage: category.heroImage,
    displayOrder: category.displayOrder,
    isFeatured: category.isFeatured,
  }));

  return <CategoriesClient initialCategories={initialCategories} />;
}
