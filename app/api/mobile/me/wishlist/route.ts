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

export async function GET(): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();
    const user = await User.findById(auth.user.sub).select("wishlist").lean();
    const products = await Product.find({ _id: { $in: user?.wishlist ?? [] }, ...PUBLIC_PRODUCT_FILTER })
      .select(PUBLIC_PRODUCT_FIELDS)
      .populate("category", "name slug")
      .lean();
    return apiSuccess({ products: products.map(toMobileProductCard) });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

async function readProductId(request: NextRequest): Promise<string | null> {
  const fromQuery = request.nextUrl.searchParams.get("productId");
  if (fromQuery) return fromQuery;
  const body = (await request.json().catch(() => null)) as { productId?: unknown } | null;
  return typeof body?.productId === "string" ? body.productId : null;
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const productId = await readProductId(request);
    if (!productId || !Types.ObjectId.isValid(productId)) return apiError("Invalid dress", 400);
    await connectToDatabase();
    await User.updateOne({ _id: auth.user.sub }, { $addToSet: { wishlist: productId } });
    return apiSuccess({ wishlisted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const productId = await readProductId(request);
    if (!productId || !Types.ObjectId.isValid(productId)) return apiError("Invalid dress", 400);
    await connectToDatabase();
    await User.updateOne({ _id: auth.user.sub }, { $pull: { wishlist: productId } });
    return apiSuccess({ wishlisted: false });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
