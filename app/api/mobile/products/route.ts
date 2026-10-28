import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ALL_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";
import { buildWordSearchClauses } from "@/lib/utils";
import {
  PUBLIC_PRODUCT_FIELDS,
  PUBLIC_PRODUCT_FILTER,
  toMobileProductCard,
} from "@/lib/mobile/catalog";
import { PREMIUM_PERKS, premiumStateOf } from "@/lib/mobile/premium";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  price_asc: { rentalPricePerDay: 1 },
  price_desc: { rentalPricePerDay: -1 },
  rating: { averageRating: -1 },
};

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") ?? "20")));
    const categorySlug = params.get("category");
    const search = params.get("search")?.trim();
    const designer = params.get("designer")?.trim();
    const sort = SORTS[params.get("sort") ?? "newest"] ?? SORTS.newest;

    const user = await User.findById(auth.user.sub).select("premium").lean();
    const premium = premiumStateOf(user?.premium);

    const filter: Record<string, unknown> = { ...PUBLIC_PRODUCT_FILTER };
    if (!premium.isActive) {
      // Early-access new arrivals stay hidden from non-members.
      const cutoff = new Date(Date.now() - PREMIUM_PERKS.earlyAccessDays * 86_400_000);
      filter.$or = [{ isNewArrival: { $ne: true } }, { createdAt: { $lte: cutoff } }];
    }
    if (categorySlug) {
      const category = await Category.findOne({ slug: categorySlug }).select("_id").lean();
      filter.category = category?._id ?? null;
    }
    if (designer) filter.designer = designer;
    if (search) {
      // Every typed word must match somewhere, in any order.
      filter.$and = buildWordSearchClauses(search, [
        "name",
        "designer",
        "dressType",
        "color",
        "fabric",
        "tags",
      ]);
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select(PUBLIC_PRODUCT_FIELDS)
        .populate("category", "name slug")
        .sort({ ...sort, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return apiSuccess({
      products: products.map(toMobileProductCard),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
