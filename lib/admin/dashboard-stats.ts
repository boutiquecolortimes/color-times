import "server-only";
import { unstable_cache } from "next/cache";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking, type BookingStatus } from "@/models/Booking";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { User } from "@/models/User";
import { Invoice, type InvoiceStatus } from "@/models/Invoice";
import { Settings } from "@/models/Settings";
import { DEFAULT_INVENTORY_SETTINGS } from "@/lib/validations/inventory-settings";

const REVENUE_STATUSES = ["confirmed", "in_use", "returned"];

const BOOKING_STATUSES: BookingStatus[] = [
  "inquiry",
  "pending_payment",
  "confirmed",
  "in_use",
  "returned",
  "cancelled",
];

const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];

export interface DashboardStats {
  totalRevenue: number;
  totalBookings: number;
  activeRentals: number;
  totalCustomers: number;
  totalProducts: number;
  outstandingBalance: number;
  returnsDue: number;
  availableDresses: number;
  reservedDresses: number;
  todaysBookings: number;
  todaysPickups: number;
  todaysReturns: number;
  returnedToday: number;
  pendingPaymentsCount: number;
  monthlyRevenueTotal: number;
  previousMonthRevenueTotal: number;
  lowStockCount: number;
  newCustomersThisMonth: number;
  newCustomersPreviousMonth: number;
  categoryBookingBreakdown: { category: string; bookings: number }[];
  recentBookings: {
    _id: string;
    bookingNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    rentalStartDate: string;
    rentalEndDate: string;
    customer: { name: string } | null;
    productSummary: string;
  }[];
  monthlyRevenue: { label: string; revenue: number; bookings: number }[];
}

async function computeDashboardStats(): Promise<DashboardStats> {
  await connectToDatabase();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfPreviousMonth = new Date(startOfMonth);
  startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1);

  const [
    totalRevenueResult,
    totalBookings,
    activeRentals,
    totalCustomers,
    totalProducts,
    returnsDue,
    outstandingBalanceResult,
    availableDresses,
    reservedDresses,
    todaysBookings,
    todaysPickups,
    todaysReturns,
    returnedToday,
    pendingPaymentsCount,
    monthlyRevenueTotalResult,
    previousMonthRevenueTotalResult,
    inventorySettingsDoc,
    productStockTotals,
    newCustomersThisMonth,
    newCustomersPreviousMonth,
    categoryBookingBreakdownResult,
    recentBookings,
    monthlyRevenue,
  ] = await Promise.all([
    Booking.aggregate([
      { $match: { status: { $in: REVENUE_STATUSES }, deletedAt: null } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Booking.countDocuments({ deletedAt: null }),
    Booking.countDocuments({ status: "in_use", deletedAt: null }),
    User.countDocuments({ role: "customer", deletedAt: null }),
    Product.countDocuments({ isActive: true, deletedAt: null }),
    Booking.countDocuments({
      status: { $in: ["confirmed", "in_use"] },
      rentalEndDate: { $lt: new Date() },
      deletedAt: null,
    }),
    Invoice.aggregate([
      {
        $match: {
          deletedAt: null,
          status: { $in: ["sent", "partially_paid", "overdue"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amountDue" } } },
    ]),
    Product.countDocuments({ status: "available", isActive: true, deletedAt: null }),
    Product.countDocuments({
      status: { $in: ["reserved", "booked"] },
      isActive: true,
      deletedAt: null,
    }),
    Booking.countDocuments({
      createdAt: { $gte: startOfToday, $lt: startOfTomorrow },
      deletedAt: null,
    }),
    Booking.countDocuments({
      rentalStartDate: { $gte: startOfToday, $lt: startOfTomorrow },
      status: { $ne: "cancelled" },
      deletedAt: null,
    }),
    Booking.countDocuments({
      rentalEndDate: { $gte: startOfToday, $lt: startOfTomorrow },
      status: { $ne: "cancelled" },
      deletedAt: null,
    }),
    Booking.countDocuments({
      returnedAt: { $gte: startOfToday, $lt: startOfTomorrow },
      deletedAt: null,
    }),
    Invoice.countDocuments({
      deletedAt: null,
      status: { $in: ["sent", "partially_paid", "overdue"] },
    }),
    Booking.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: startOfMonth },
          deletedAt: null,
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Booking.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: startOfPreviousMonth, $lt: startOfMonth },
          deletedAt: null,
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Settings.findOne({ module: "inventory" }).lean(),
    Product.aggregate([
      { $match: { isActive: true, deletedAt: null } },
      { $unwind: "$variants" },
      { $group: { _id: "$_id", totalStock: { $sum: "$variants.quantityInStock" } } },
    ]),
    User.countDocuments({ role: "customer", createdAt: { $gte: startOfMonth }, deletedAt: null }),
    User.countDocuments({
      role: "customer",
      createdAt: { $gte: startOfPreviousMonth, $lt: startOfMonth },
      deletedAt: null,
    }),
    Booking.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: startOfMonth },
          deletedAt: null,
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "items.product",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      { $unwind: "$productDoc" },
      {
        $lookup: {
          from: Category.collection.name,
          localField: "productDoc.category",
          foreignField: "_id",
          as: "categoryDoc",
        },
      },
      { $unwind: "$categoryDoc" },
      { $group: { _id: "$categoryDoc.name", bookings: { $sum: 1 } } },
      { $sort: { bookings: -1 } },
    ]),
    Booking.find({ deletedAt: null })
      .populate("customer", "name")
      .populate("items.product", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Booking.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: sixMonthsAgo },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  return {
    totalRevenue: totalRevenueResult[0]?.total ?? 0,
    totalBookings,
    activeRentals,
    totalCustomers,
    totalProducts,
    returnsDue,
    outstandingBalance: outstandingBalanceResult[0]?.total ?? 0,
    availableDresses,
    reservedDresses,
    todaysBookings,
    todaysPickups,
    todaysReturns,
    returnedToday,
    pendingPaymentsCount,
    monthlyRevenueTotal: monthlyRevenueTotalResult[0]?.total ?? 0,
    previousMonthRevenueTotal: previousMonthRevenueTotalResult[0]?.total ?? 0,
    lowStockCount: (() => {
      const threshold =
        (inventorySettingsDoc?.data as { lowStockThreshold: number } | undefined)
          ?.lowStockThreshold ?? DEFAULT_INVENTORY_SETTINGS.lowStockThreshold;
      return productStockTotals.filter((p) => p.totalStock <= threshold).length;
    })(),
    newCustomersThisMonth,
    newCustomersPreviousMonth,
    categoryBookingBreakdown: categoryBookingBreakdownResult.map((entry) => ({
      category: entry._id,
      bookings: entry.bookings,
    })),
    recentBookings: recentBookings.map((booking) => ({
      _id: String(booking._id),
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      totalAmount: booking.totalAmount,
      createdAt: booking.createdAt.toISOString(),
      rentalStartDate: booking.rentalStartDate.toISOString(),
      rentalEndDate: booking.rentalEndDate.toISOString(),
      customer: booking.customer
        ? { name: (booking.customer as unknown as { name: string }).name }
        : null,
      productSummary:
        booking.items
          .map((item) => (item.product as unknown as { name: string } | null)?.name)
          .filter(Boolean)
          .join(", ") || "Unknown product",
    })),
    monthlyRevenue: monthlyRevenue.map((entry) => ({
      label: new Date(entry._id.year, entry._id.month - 1).toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      }),
      revenue: entry.revenue,
      bookings: entry.bookings,
    })),
  };
}

export const getDashboardStats = unstable_cache(computeDashboardStats, ["dashboard-stats"], {
  revalidate: 30,
});

export interface DashboardAnalytics {
  bookingStatusBreakdown: { status: BookingStatus; count: number }[];
  invoiceStatusBreakdown: { status: InvoiceStatus; count: number; total: number }[];
  categoryRevenue: { category: string; revenue: number; bookings: number }[];
  topProducts: { name: string; bookings: number; revenue: number }[];
  monthlyTrend: { label: string; revenue: number; bookings: number; newCustomers: number }[];
}

export interface DashboardDateRange {
  from: Date | null;
  to: Date | null;
}

async function computeDashboardAnalytics(
  range?: DashboardDateRange
): Promise<DashboardAnalytics> {
  await connectToDatabase();

  const createdAtFilter: Record<string, unknown> = {};
  if (range?.from) createdAtFilter.$gte = range.from;
  if (range?.to) createdAtFilter.$lt = range.to;
  const hasRangeFilter = Object.keys(createdAtFilter).length > 0;

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [
    bookingStatusResult,
    invoiceStatusResult,
    categoryRevenueResult,
    topProductsResult,
    monthlyBookingsResult,
    monthlyCustomersResult,
  ] = await Promise.all([
    Booking.aggregate([
      { $match: { deletedAt: null, ...(hasRangeFilter ? { createdAt: createdAtFilter } : {}) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { deletedAt: null, ...(hasRangeFilter ? { createdAt: createdAtFilter } : {}) } },
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$total" } } },
    ]),
    Booking.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          deletedAt: null,
          ...(hasRangeFilter ? { createdAt: createdAtFilter } : {}),
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "items.product",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      { $unwind: "$productDoc" },
      {
        $lookup: {
          from: Category.collection.name,
          localField: "productDoc.category",
          foreignField: "_id",
          as: "categoryDoc",
        },
      },
      { $unwind: "$categoryDoc" },
      {
        $group: {
          _id: "$categoryDoc.name",
          revenue: { $sum: "$items.rentalFee" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Booking.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          deletedAt: null,
          ...(hasRangeFilter ? { createdAt: createdAtFilter } : {}),
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          bookings: { $sum: 1 },
          revenue: { $sum: "$items.rentalFee" },
        },
      },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      { $unwind: "$productDoc" },
    ]),
    Booking.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          deletedAt: null,
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    User.aggregate([
      { $match: { role: "customer", deletedAt: null, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const bookingCountByStatus = new Map<string, number>(
    bookingStatusResult.map((entry) => [entry._id, entry.count])
  );
  const invoiceByStatus = new Map<string, { count: number; total: number }>(
    invoiceStatusResult.map((entry) => [entry._id, { count: entry.count, total: entry.total }])
  );
  const newCustomersByKey = new Map<string, number>(
    monthlyCustomersResult.map((entry) => [`${entry._id.year}-${entry._id.month}`, entry.count])
  );

  return {
    bookingStatusBreakdown: BOOKING_STATUSES.map((status) => ({
      status,
      count: bookingCountByStatus.get(status) ?? 0,
    })),
    invoiceStatusBreakdown: INVOICE_STATUSES.map((status) => ({
      status,
      count: invoiceByStatus.get(status)?.count ?? 0,
      total: invoiceByStatus.get(status)?.total ?? 0,
    })),
    categoryRevenue: categoryRevenueResult.map((entry) => ({
      category: entry._id,
      revenue: entry.revenue,
      bookings: entry.bookings,
    })),
    topProducts: topProductsResult.map((entry) => ({
      name: entry.productDoc.name,
      bookings: entry.bookings,
      revenue: entry.revenue,
    })),
    monthlyTrend: monthlyBookingsResult.map((entry) => ({
      label: new Date(entry._id.year, entry._id.month - 1).toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      }),
      revenue: entry.revenue,
      bookings: entry.bookings,
      newCustomers: newCustomersByKey.get(`${entry._id.year}-${entry._id.month}`) ?? 0,
    })),
  };
}

const getCachedDashboardAnalytics = unstable_cache(
  async (fromMs: number | null, toMs: number | null) =>
    computeDashboardAnalytics({
      from: fromMs !== null ? new Date(fromMs) : null,
      to: toMs !== null ? new Date(toMs) : null,
    }),
  ["dashboard-analytics"],
  { revalidate: 60 }
);

export async function getDashboardAnalytics(
  range?: DashboardDateRange
): Promise<DashboardAnalytics> {
  return getCachedDashboardAnalytics(range?.from?.getTime() ?? null, range?.to?.getTime() ?? null);
}
