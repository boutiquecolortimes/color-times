import "server-only";
import { Invoice } from "@/models/Invoice";

// Older invoices have no `source` stored — they count as "booking" when they
// have a booking link, otherwise "manual".
export function invoiceTypeFilter(type: string): Record<string, unknown> {
  switch (type) {
    case "booking":
      return {
        $or: [{ source: "booking" }, { source: { $exists: false }, booking: { $ne: null } }],
      };
    case "manual":
      return {
        $or: [
          { source: "manual" },
          { source: { $exists: false }, $or: [{ booking: null }, { booking: { $exists: false } }] },
        ],
      };
    default:
      return { source: type };
  }
}

export interface InvoiceTypeCounts {
  all: number;
  booking: number;
  sale: number;
  customisation: number;
  manual: number;
}

export async function getInvoiceTypeCounts(
  filter: Record<string, unknown>
): Promise<InvoiceTypeCounts> {
  const rows = await Invoice.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          $ifNull: [
            "$source",
            { $cond: [{ $ifNull: ["$booking", false] }, "booking", "manual"] },
          ],
        },
        count: { $sum: 1 },
      },
    },
  ]);
  const counts: InvoiceTypeCounts = { all: 0, booking: 0, sale: 0, customisation: 0, manual: 0 };
  for (const row of rows as { _id: keyof InvoiceTypeCounts; count: number }[]) {
    if (row._id in counts) counts[row._id] += row.count;
    counts.all += row.count;
  }
  return counts;
}
