import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import type { ProductSize } from "@/models/Product";

interface ImportRow {
  name?: string;
  code?: string;
  sku?: string; // legacy header name, still accepted
  category?: string;
  designer?: string;
  description?: string;
  color?: string;
  fabric?: string;
  image?: string;
  sizes?: string;
  rentalPricePerDay?: string;
  retailValue?: string;
  securityDeposit?: string;
  isActive?: string;
  isFeatured?: string;
  isNewArrival?: string;
  tags?: string;
}

interface ImportResult {
  row: number;
  name: string;
  status: "created" | "skipped";
  reason?: string;
}

const VALID_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL", "Custom"]);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseSizes(raw: string | undefined): { size: ProductSize; quantityInStock: number }[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [size, qty] = pair.split(":").map((part) => part.trim());
      return { size: size as ProductSize, quantityInStock: Number(qty) || 0 };
    })
    .filter((variant) => VALID_SIZES.has(variant.size));
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0) {
      return apiError("No rows to import", 400);
    }
    if (rows.length > 500) {
      return apiError("Import is limited to 500 rows at a time", 400);
    }

    await connectToDatabase();

    const categories = await Category.find().select("name slug").lean();
    const categoryByName = new Map(
      categories.map((cat) => [cat.name.toLowerCase(), String(cat._id)])
    );
    const categoryBySlug = new Map(categories.map((cat) => [cat.slug, String(cat._id)]));

    const results: ImportResult[] = [];
    const createdIds: string[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNumber = i + 2; // account for header row
      const name = row.name?.trim();

      if (!name) {
        results.push({ row: rowNumber, name: "(unnamed)", status: "skipped", reason: "Missing name" });
        continue;
      }

      const categoryKey = row.category?.trim().toLowerCase() ?? "";
      const categoryId = categoryByName.get(categoryKey) ?? categoryBySlug.get(categoryKey);

      if (!categoryId) {
        results.push({ row: rowNumber, name, status: "skipped", reason: `Unknown category "${row.category ?? ""}"` });
        continue;
      }

      const variants = parseSizes(row.sizes);
      if (variants.length === 0) {
        results.push({ row: rowNumber, name, status: "skipped", reason: "No valid sizes (use format S:5,M:3)" });
        continue;
      }

      const sku = (row.code?.trim() || row.sku?.trim() || `IMP-${Date.now()}-${i}`).toUpperCase();
      const slug = slugify(name);

      const existing = await Product.findOne({ $or: [{ sku }, { slug }] }).lean();
      if (existing) {
        results.push({ row: rowNumber, name, status: "skipped", reason: "Code or slug already exists" });
        continue;
      }

      const product = await Product.create({
        name,
        slug,
        sku,
        category: categoryId,
        designer: row.designer?.trim() || undefined,
        description: row.description?.trim() || `${name} — imported product, description pending.`,
        color: row.color?.trim() || "Not specified",
        fabric: row.fabric?.trim() || "Not specified",
        images: row.image?.trim() ? [row.image.trim()] : ["/images/placeholder/dresses/dress-1.png"],
        variants,
        rentalPricePerDay: Number(row.rentalPricePerDay) || 0,
        retailValue: Number(row.retailValue) || 0,
        securityDeposit: Number(row.securityDeposit) || 0,
        isActive: parseBoolean(row.isActive, true),
        isFeatured: parseBoolean(row.isFeatured, false),
        isNewArrival: parseBoolean(row.isNewArrival, false),
        tags: row.tags ? row.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      });

      createdIds.push(String(product._id));
      results.push({ row: rowNumber, name, status: "created" });
    }

    if (createdIds.length > 0) {
      await recordAuditLog({
        entityType: "Product",
        entityId: "bulk",
        action: "import",
        actor: auth.user,
        metadata: { count: createdIds.length, ids: createdIds },
      });
    }

    return apiSuccess({
      results,
      createdCount: results.filter((r) => r.status === "created").length,
      skippedCount: results.filter((r) => r.status === "skipped").length,
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
