import "server-only";
import type { Types } from "mongoose";

export const PUBLIC_PRODUCT_FILTER = { isActive: true, archivedAt: null, deletedAt: null };

export interface MobileProductCard {
  _id: string;
  name: string;
  designer: string;
  category: { _id: string; name: string; slug: string } | null;
  rentalPricePerDay: number;
  securityDeposit: number;
  retailValue: number;
  color: string;
  fabric: string;
  images: string[];
  sizes: string[];
  isNewArrival: boolean;
  isFeatured: boolean;
  averageRating: number;
  reviewCount: number;
}

interface RawProduct {
  _id: Types.ObjectId | string;
  name: string;
  designer?: string;
  category?: unknown;
  rentalPricePerDay: number;
  securityDeposit?: number;
  retailValue?: number;
  color?: string;
  fabric?: string;
  images?: string[];
  variants?: { size: string }[];
  isNewArrival?: boolean;
  isFeatured?: boolean;
  averageRating?: number;
  reviewCount?: number;
}

/** Public-safe projection: never leaks purchase price, dealer or cost fields. */
export function toMobileProductCard(product: RawProduct): MobileProductCard {
  const category =
    product.category && typeof product.category === "object" && "name" in product.category
      ? (product.category as { _id: unknown; name: string; slug: string })
      : null;
  return {
    _id: String(product._id),
    name: product.name,
    designer: product.designer ?? "",
    category: category
      ? { _id: String(category._id), name: category.name, slug: category.slug }
      : null,
    rentalPricePerDay: product.rentalPricePerDay,
    securityDeposit: product.securityDeposit ?? 0,
    retailValue: product.retailValue ?? 0,
    color: product.color ?? "",
    fabric: product.fabric ?? "",
    images: product.images ?? [],
    sizes: (product.variants ?? []).map((variant) => variant.size),
    isNewArrival: Boolean(product.isNewArrival),
    isFeatured: Boolean(product.isFeatured),
    averageRating: product.averageRating ?? 0,
    reviewCount: product.reviewCount ?? 0,
  };
}

export const PUBLIC_PRODUCT_FIELDS =
  "name designer category rentalPricePerDay securityDeposit retailValue color fabric images variants isNewArrival isFeatured averageRating reviewCount description dressType work tags createdAt";
