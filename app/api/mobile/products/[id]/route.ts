import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import "@/models/Category";
import { requireApiRole } from "@/lib/api/require-role";
import { ALL_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import {
  PUBLIC_PRODUCT_FIELDS,
  PUBLIC_PRODUCT_FILTER,
  toMobileProductCard,
} from "@/lib/mobile/catalog";
import { findBookingConflicts } from "@/lib/admin/booking-availability";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return apiError("Dress not found", 404);

    await connectToDatabase();
    const [product, user] = await Promise.all([
      Product.findOne({ _id: id, ...PUBLIC_PRODUCT_FILTER })
        .select(PUBLIC_PRODUCT_FIELDS)
        .populate("category", "name slug")
        .lean(),
      User.findById(auth.user.sub).select("wishlist").lean(),
    ]);
    if (!product) return apiError("Dress not found", 404);

    // Optional availability check for a date window the customer picked.
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    let availability: { available: boolean } | null = null;
    if (from && to) {
      const conflicts = await findBookingConflicts(id, new Date(from), new Date(to));
      availability = { available: conflicts.length === 0 };
    }

    const relatedFilter: Record<string, unknown> = {
      ...PUBLIC_PRODUCT_FILTER,
      category: (product.category as unknown as { _id: unknown } | null)?._id ?? null,
      _id: { $ne: product._id },
    };
    const related = await Product.find(relatedFilter)
      .select(PUBLIC_PRODUCT_FIELDS)
      .populate("category", "name slug")
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(8)
      .lean();

    return apiSuccess({
      product: {
        ...toMobileProductCard(product),
        description: product.description ?? "",
        dressType: product.dressType ?? "",
        work: product.work ?? "",
        tags: product.tags ?? [],
      },
      isWishlisted: (user?.wishlist ?? []).some((wid) => String(wid) === id),
      availability,
      related: related.map(toMobileProductCard),
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
