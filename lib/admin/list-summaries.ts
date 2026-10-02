// Summary tiles + tab counts for the Sales and Customisation lists. Shared
// by each page's server render (first load) and its list API (every
// filter change), so both always agree.
import { Sale } from "@/models/Sale";
import { CustomisationOrder } from "@/models/CustomisationOrder";

export interface MoneySummary {
  totalAmount: number;
  advancePayment: number;
  dueAmount: number;
}

export interface SalesListSummary {
  summary: MoneySummary;
  paymentCounts: { all: number; due: number; paid: number };
}

export async function getSalesListSummary(
  baseFilter: Record<string, unknown>
): Promise<SalesListSummary> {
  const [row] = await Sale.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        dueCount: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$dueAmount", 0] }, 0] }, 1, 0] } },
        totalAmount: { $sum: { $ifNull: ["$totalAmount", 0] } },
        advancePayment: { $sum: { $ifNull: ["$advancePayment", 0] } },
        dueAmount: { $sum: { $ifNull: ["$dueAmount", 0] } },
      },
    },
  ]);
  const r = row ?? { count: 0, dueCount: 0, totalAmount: 0, advancePayment: 0, dueAmount: 0 };
  return {
    summary: { totalAmount: r.totalAmount, advancePayment: r.advancePayment, dueAmount: r.dueAmount },
    paymentCounts: { all: r.count, due: r.dueCount, paid: r.count - r.dueCount },
  };
}

export interface CustomisationListSummary {
  summary: MoneySummary;
  statusCounts: Record<string, number>;
}

/**
 * baseFilter: search/date/trash only (drives tab counts).
 * filter: baseFilter plus the active status tab (drives the money tiles).
 * Cancelled orders are left out of money totals unless that tab is open.
 */
export async function getCustomisationListSummary(
  baseFilter: Record<string, unknown>,
  filter: Record<string, unknown>
): Promise<CustomisationListSummary> {
  const [statusAgg, summaryAgg] = await Promise.all([
    CustomisationOrder.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    CustomisationOrder.aggregate([
      { $match: { ...filter, status: filter.status ?? { $ne: "cancelled" } } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $ifNull: ["$totalAmount", 0] } },
          advancePayment: { $sum: { $ifNull: ["$advancePayment", 0] } },
          dueAmount: { $sum: { $ifNull: ["$dueAmount", 0] } },
        },
      },
    ]),
  ]);
  const statusCounts: Record<string, number> = { all: 0 };
  for (const row of statusAgg as { _id: string; count: number }[]) {
    statusCounts[row._id] = row.count;
    statusCounts.all += row.count;
  }
  const s = summaryAgg[0] ?? { totalAmount: 0, advancePayment: 0, dueAmount: 0 };
  return {
    summary: { totalAmount: s.totalAmount, advancePayment: s.advancePayment, dueAmount: s.dueAmount },
    statusCounts,
  };
}
