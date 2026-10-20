import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ALL_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";
import {
  PUBLIC_PRODUCT_FIELDS,
  PUBLIC_PRODUCT_FILTER,
  toMobileProductCard,
} from "@/lib/mobile/catalog";
import { PREMIUM_PERKS, premiumStateOf } from "@/lib/mobile/premium";

/** Everything the customer home screen needs in one round trip. */
export async function GET(): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();
    const user = await User.findById(auth.user.sub).select("premium").lean();
    const premium = premiumStateOf(user?.premium);

    // Members see new arrivals the moment they're listed; everyone else
    // after the early-access window.
    const earlyAccessCutoff = new Date(
      Date.now() - PREMIUM_PERKS.earlyAccessDays * 24 * 60 * 60 * 1000
    );
    const newArrivalFilter = {
      ...PUBLIC_PRODUCT_FILTER,
      isNewArrival: true,
      ...(premium.isActive ? {} : { createdAt: { $lte: earlyAccessCutoff } }),
    };

    const [categories, featured, newArrivals, earlyAccessCount, designers] = await Promise.all([
      Category.find({ deletedAt: null }).sort({ displayOrder: 1, name: 1 }).lean(),
      Product.find({ ...PUBLIC_PRODUCT_FILTER, isFeatured: true })
        .select(PUBLIC_PRODUCT_FIELDS)
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Product.find(newArrivalFilter)
        .select(PUBLIC_PRODUCT_FIELDS)
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      premium.isActive
        ? Promise.resolve(0)
        : Product.countDocuments({
            ...PUBLIC_PRODUCT_FILTER,
            isNewArrival: true,
            createdAt: { $gt: earlyAccessCutoff },
          }),
      Product.aggregate<{ _id: string; count: number; image?: string }>([
        { $match: { ...PUBLIC_PRODUCT_FILTER, designer: { $nin: [null, ""] } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$designer", count: { $sum: 1 }, image: { $first: { $arrayElemAt: ["$images", 0] } } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    // Categories without their own hero image borrow their newest product's.
    const heroFallback = new Map<string, string>();
    const missingHero = categories.filter((c) => !c.heroImage || c.heroImage.startsWith("/"));
    if (missingHero.length > 0) {
      const products = await Product.find({
        ...PUBLIC_PRODUCT_FILTER,
        category: { $in: missingHero.map((c) => c._id) },
      })
        .select("category images")
        .sort({ isFeatured: -1, createdAt: -1 })
        .lean();
      for (const product of products) {
        const key = String(product.category);
        if (!heroFallback.has(key) && product.images[0]) heroFallback.set(key, product.images[0]);
      }
    }

    return apiSuccess({
      premium,
      lockedEarlyAccessCount: earlyAccessCount,
      categories: categories.map((category) => ({
        _id: String(category._id),
        name: category.name,
        slug: category.slug,
        description: category.description,
        heroImage:
          category.heroImage && !category.heroImage.startsWith("/")
            ? category.heroImage
            : heroFallback.get(String(category._id)) ?? "",
      })),
      featured: featured.map(toMobileProductCard),
      designers: designers.map((d) => ({ name: d._id, productCount: d.count, image: d.image ?? "" })),
      newArrivals: newArrivals.map(toMobileProductCard),
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
