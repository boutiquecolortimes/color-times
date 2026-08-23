import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import "@/models/Category";
import { productSchema } from "@/lib/validations/product";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { escapeRegex } from "@/lib/utils";

const SORTABLE_FIELDS = new Set([
  "name",
  "sku",
  "rentalPricePerDay",
  "createdAt",
  "updatedAt",
]);

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const all = searchParams.get("all") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const search = searchParams.get("search")?.trim();
  const category = searchParams.get("category");
  const status = searchParams.get("status") ?? "active";
  const sortField = searchParams.get("sortBy") ?? "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;

  const filter: Record<string, unknown> = {};

  if (status === "trash") {
    filter.deletedAt = { $ne: null };
  } else if (status === "archived") {
    filter.deletedAt = null;
    filter.archivedAt = { $ne: null };
  } else {
    // "active" and "all" both exclude trashed items; "all" includes archived
    filter.deletedAt = null;
    if (status === "active") {
      filter.archivedAt = null;
    }
  }

  if (search) {
    // Partial, case-insensitive match across product code (SKU), name, and
    // other descriptive fields — $text only did whole-word stemmed matches
    // on name/description/tags and never covered SKU, so typing a code or
    // half a dress name returned nothing.
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { name: regex },
      { sku: regex },
      { designer: regex },
      { dressType: regex },
      { color: regex },
      { fabric: regex },
      { work: regex },
      { tags: regex },
    ];
  }
  if (category) {
    filter.category = category;
  }

  const sort: Record<string, 1 | -1> = {
    [SORTABLE_FIELDS.has(sortField) ? sortField : "createdAt"]: sortDir,
  };

  const baseQuery = Product.find(filter).populate("category", "name slug").sort(sort);

  const [products, total] = await Promise.all([
    all ? baseQuery.lean() : baseQuery.skip((page - 1) * pageSize).limit(pageSize).lean(),
    Product.countDocuments(filter),
  ]);

  return apiSuccess({
    products,
    pagination: all
      ? { page: 1, pageSize: total || 1, total, totalPages: 1 }
      : { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = productSchema.parse(body);

    await connectToDatabase();

    const existing = await Product.findOne({
      $or: [{ slug: input.slug }, { sku: input.sku }],
    }).lean();
    if (existing) {
      // Trashed (soft-deleted) products still hold their code/slug, since
      // the uniqueness check isn't scoped to deletedAt — surface that so an
      // admin isn't stuck wondering why a "deleted" product blocks re-use.
      const message = existing.deletedAt
        ? "A product with this code or slug already exists in Trash — open Products, filter by Trash, and permanently delete it to reuse this code"
        : "A product with this code or slug already exists";
      return apiError(message, 409);
    }

    // Retail value and security deposit aren't on the Pricing tab anymore —
    // auto-derive them from the rental price (same formula Quick Add used to
    // use) so booking deposits and invoices keep working unchanged.
    const retailValue = input.retailValue ?? Math.round(input.rentalPricePerDay * 12);
    const securityDeposit = input.securityDeposit ?? Math.round(input.rentalPricePerDay * 2);

    // Images/sizes can be filled in later — don't block Save if the admin
    // hasn't visited those tabs yet. No uploaded photo shows the store logo
    // (not a stock dress photo) everywhere this product's image is used.
    const images = input.images.length > 0 ? input.images : ["/logo.png"];
    const variants =
      input.variants.length > 0 ? input.variants : [{ size: "M" as const, quantityInStock: 0 }];

    const product = await Product.create({
      ...input,
      images,
      variants,
      retailValue,
      securityDeposit,
    });

    await recordAuditLog({
      entityType: "Product",
      entityId: String(product._id),
      action: "create",
      actor: auth.user,
      snapshot: product.toObject() as unknown as Record<string, unknown>,
    });

    return apiSuccess({ product }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
