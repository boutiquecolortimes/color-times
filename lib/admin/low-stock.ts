import "server-only";
import { Product } from "@/models/Product";
import { Settings } from "@/models/Settings";
import { DEFAULT_INVENTORY_SETTINGS } from "@/lib/validations/inventory-settings";

/**
 * Active products whose stock (all sizes together) is at or below the
 * inventory low-stock threshold. Same rule as the dashboard's "Low Stock
 * Items" card (lib/admin/dashboard-stats.ts).
 */
export async function lowStockProductIds(): Promise<unknown[]> {
  const [settingsDoc, totals] = await Promise.all([
    Settings.findOne({ module: "inventory" }).lean(),
    Product.aggregate([
      { $match: { isActive: true, deletedAt: null } },
      { $unwind: "$variants" },
      { $group: { _id: "$_id", totalStock: { $sum: "$variants.quantityInStock" } } },
    ]),
  ]);
  const threshold =
    (settingsDoc?.data as { lowStockThreshold?: number } | undefined)?.lowStockThreshold ??
    DEFAULT_INVENTORY_SETTINGS.lowStockThreshold;
  return (totals as { _id: unknown; totalStock: number }[])
    .filter((p) => p.totalStock <= threshold)
    .map((p) => p._id);
}
