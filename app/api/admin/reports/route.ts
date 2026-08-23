import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { Booking } from "@/models/Booking";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { ServiceOrder } from "@/models/ServiceOrder";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import { Sale } from "@/models/Sale";
import "@/models/Category";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import {
  resolveDateRange,
  buildDateFilter,
  type DateRangePreset,
} from "@/lib/admin/date-ranges";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const REVENUE_STATUSES = ["confirmed", "in_use", "returned"];

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function buildPagination(total: number, page: number, pageSize: number, all: boolean): Pagination {
  if (all) {
    return { page: 1, pageSize: total || 1, total, totalPages: 1 };
  }
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

function skipLimit(page: number, pageSize: number, all: boolean): { skip: number; limit: number } {
  return all ? { skip: 0, limit: 0 } : { skip: (page - 1) * pageSize, limit: pageSize };
}

async function buildProductsReport(
  dateFilter: Record<string, unknown>,
  status: string | null,
  page: number,
  pageSize: number,
  all: boolean
) {
  const filter: Record<string, unknown> = { ...dateFilter };
  if (!status || status === "active") {
    filter.deletedAt = null;
    filter.archivedAt = null;
  } else if (status === "archived") {
    filter.archivedAt = { $ne: null };
    filter.deletedAt = null;
  } else if (status === "trash") {
    filter.deletedAt = { $ne: null };
  }

  const { skip, limit } = skipLimit(page, pageSize, all);

  const [totalProducts, statsAgg, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          activeCount: { $sum: { $cond: ["$isActive", 1, 0] } },
          totalStockUnits: { $sum: { $sum: "$variants.quantityInStock" } },
          totalStockValue: {
            $sum: { $multiply: ["$retailValue", { $sum: "$variants.quantityInStock" }] },
          },
        },
      },
    ]),
    Product.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const stats = statsAgg[0] ?? { activeCount: 0, totalStockUnits: 0, totalStockValue: 0 };

  const mappedItems = products.map((p) => ({
    _id: String(p._id),
    name: p.name,
    sku: p.sku,
    category: (p.category as unknown as { name: string } | null)?.name ?? "—",
    rentalPricePerDay: p.rentalPricePerDay,
    retailValue: p.retailValue,
    totalStock: p.variants.reduce((s, v) => s + v.quantityInStock, 0),
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }));

  return {
    summary: {
      totalProducts,
      activeCount: stats.activeCount,
      totalStockUnits: stats.totalStockUnits,
      totalStockValue: stats.totalStockValue,
    },
    items: mappedItems,
    pagination: buildPagination(totalProducts, page, pageSize, all),
  };
}

async function buildBookingsReport(
  dateFilter: Record<string, unknown>,
  status: string | null,
  page: number,
  pageSize: number,
  all: boolean
) {
  const filter: Record<string, unknown> = { ...dateFilter, deletedAt: null };
  if (status && status !== "all") filter.status = status;

  const { skip, limit } = skipLimit(page, pageSize, all);

  const [totalBookings, revenueAgg, activeCount, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.aggregate([
      { $match: { ...filter, status: { $in: REVENUE_STATUSES } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Booking.countDocuments({ ...filter, status: "in_use" }),
    Booking.find(filter)
      .populate("customer", "name")
      .populate("items.product", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const totalRevenue = revenueAgg[0]?.total ?? 0;
  const revenueCount = revenueAgg[0]?.count ?? 0;

  const mappedItems = bookings.map((b) => ({
    _id: String(b._id),
    bookingNumber: b.bookingNumber,
    customer: (b.customer as unknown as { name: string } | null)?.name ?? "—",
    product:
      b.items
        .map((item) => (item.product as unknown as { name: string } | null)?.name)
        .filter(Boolean)
        .join(", ") || "—",
    status: b.status,
    totalAmount: b.totalAmount,
    rentalStartDate: b.rentalStartDate.toISOString(),
    rentalEndDate: b.rentalEndDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
  }));

  return {
    summary: {
      totalBookings,
      totalRevenue,
      avgBookingValue: revenueCount ? totalRevenue / revenueCount : 0,
      activeCount,
    },
    items: mappedItems,
    pagination: buildPagination(totalBookings, page, pageSize, all),
  };
}

async function buildInvoicesReport(
  dateFilter: Record<string, unknown>,
  status: string | null,
  page: number,
  pageSize: number,
  all: boolean
) {
  const filter: Record<string, unknown> = { ...dateFilter, deletedAt: null };
  if (status && status !== "all") filter.status = status;

  const { skip, limit } = skipLimit(page, pageSize, all);

  const [totalInvoices, totalsAgg, outstandingAgg, invoices] = await Promise.all([
    Invoice.countDocuments(filter),
    Invoice.aggregate([
      { $match: filter },
      { $group: { _id: null, totalInvoiced: { $sum: "$total" }, totalCollected: { $sum: "$amountPaid" } } },
    ]),
    Invoice.aggregate([
      { $match: { ...filter, status: { $ne: "cancelled" } } },
      { $group: { _id: null, totalOutstanding: { $sum: "$amountDue" } } },
    ]),
    Invoice.find(filter)
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const mappedItems = invoices.map((i) => ({
    _id: String(i._id),
    invoiceNumber: i.invoiceNumber,
    customer: (i.customer as unknown as { name: string } | null)?.name ?? "—",
    total: i.total,
    amountPaid: i.amountPaid,
    amountDue: i.amountDue,
    status: i.status,
    dueDate: i.dueDate.toISOString(),
    createdAt: i.createdAt.toISOString(),
  }));

  return {
    summary: {
      totalInvoices,
      totalInvoiced: totalsAgg[0]?.totalInvoiced ?? 0,
      totalCollected: totalsAgg[0]?.totalCollected ?? 0,
      totalOutstanding: outstandingAgg[0]?.totalOutstanding ?? 0,
    },
    items: mappedItems,
    pagination: buildPagination(totalInvoices, page, pageSize, all),
  };
}

async function buildCustomersReport(
  dateFilter: Record<string, unknown>,
  page: number,
  pageSize: number,
  all: boolean
) {
  const filter: Record<string, unknown> = { ...dateFilter, role: "customer", deletedAt: null };
  const { skip, limit } = skipLimit(page, pageSize, all);

  const [newCustomers, totalCustomersOverall, customers] = await Promise.all([
    User.countDocuments(filter),
    User.countDocuments({ role: "customer", deletedAt: null }),
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const mappedItems = customers.map((c) => ({
    _id: String(c._id),
    name: c.name,
    email: c.email,
    phone: c.phone ?? "—",
    fatherName: c.fatherName ?? "—",
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    summary: {
      newCustomers,
      totalCustomersOverall,
    },
    items: mappedItems,
    pagination: buildPagination(newCustomers, page, pageSize, all),
  };
}

async function buildServicesReport(
  dateFilter: Record<string, unknown>,
  status: string | null,
  serviceType: string | null,
  page: number,
  pageSize: number,
  all: boolean
) {
  const filter: Record<string, unknown> = { ...dateFilter, deletedAt: null };
  if (status && status !== "all") filter.status = status;
  if (serviceType && serviceType !== "all") filter.serviceType = serviceType;

  const { skip, limit } = skipLimit(page, pageSize, all);

  const [totalOrders, costAgg, completedCount, pendingCount, orders] = await Promise.all([
    ServiceOrder.countDocuments(filter),
    ServiceOrder.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    ServiceOrder.countDocuments({ ...filter, status: "completed" }),
    ServiceOrder.countDocuments({ ...filter, status: { $in: ["pending", "in_progress"] } }),
    ServiceOrder.find(filter)
      .populate("product", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const mappedItems = orders.map((o) => ({
    _id: String(o._id),
    product: (o.product as unknown as { name: string } | null)?.name ?? "—",
    serviceType: o.serviceType,
    description: o.description,
    stitchingType: o.stitchingType ?? "—",
    dryCleanCharge: o.dryCleanCharge ?? 0,
    ironCharge: o.ironCharge ?? 0,
    stitchingCharge: o.stitchingCharge ?? 0,
    otherCharge: o.otherCharge ?? 0,
    totalAmount: o.totalAmount,
    status: o.status,
    assignedTo: o.assignedTo ?? "—",
    sentDate: o.sentDate.toISOString(),
    expectedReturnDate: o.expectedReturnDate.toISOString(),
    createdAt: o.createdAt.toISOString(),
  }));

  return {
    summary: {
      totalOrders,
      totalCost: costAgg[0]?.total ?? 0,
      completedCount,
      pendingCount,
    },
    items: mappedItems,
    pagination: buildPagination(totalOrders, page, pageSize, all),
  };
}

async function buildCustomisationReport(
  dateFilter: Record<string, unknown>,
  status: string | null,
  page: number,
  pageSize: number,
  all: boolean
) {
  const filter: Record<string, unknown> = { ...dateFilter, deletedAt: null };
  if (status && status !== "all") filter.status = status;

  const { skip, limit } = skipLimit(page, pageSize, all);

  const [totalOrders, totalsAgg, orders] = await Promise.all([
    CustomisationOrder.countDocuments(filter),
    CustomisationOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalAdvanceCollected: { $sum: "$advancePayment" },
          totalDue: { $sum: "$dueAmount" },
        },
      },
    ]),
    CustomisationOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const mappedItems = orders.map((o) => ({
    _id: String(o._id),
    billNumber: o.billNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    stitchingType: o.stitchingType,
    totalAmount: o.totalAmount,
    advancePayment: o.advancePayment,
    dueAmount: o.dueAmount,
    status: o.status,
    orderDate: o.orderDate.toISOString(),
    createdAt: o.createdAt.toISOString(),
  }));

  return {
    summary: {
      totalOrders,
      totalRevenue: totalsAgg[0]?.totalRevenue ?? 0,
      totalAdvanceCollected: totalsAgg[0]?.totalAdvanceCollected ?? 0,
      totalDue: totalsAgg[0]?.totalDue ?? 0,
    },
    items: mappedItems,
    pagination: buildPagination(totalOrders, page, pageSize, all),
  };
}

async function buildSaleReport(
  dateFilter: Record<string, unknown>,
  page: number,
  pageSize: number,
  all: boolean
) {
  // Excludes auto-generated "source: booking" ledger entries (see
  // models/Sale.ts) — their totalAmount duplicates revenue already counted
  // in the Bookings report, so including them here would double-count it
  // and mislabel rental income as outright sales.
  const filter: Record<string, unknown> = { ...dateFilter, deletedAt: null, source: "manual" };

  const { skip, limit } = skipLimit(page, pageSize, all);

  const [totalSales, totalsAgg, sales] = await Promise.all([
    Sale.countDocuments(filter),
    Sale.aggregate([
      { $match: filter },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
    ]),
    Sale.find(filter)
      .populate("product", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const mappedItems = sales.map((s) => ({
    _id: String(s._id),
    billNumber: s.billNumber,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
    product: (s.product as unknown as { name: string } | null)?.name ?? "—",
    totalAmount: s.totalAmount,
    saleDate: s.saleDate.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));

  return {
    summary: {
      totalSales,
      totalRevenue: totalsAgg[0]?.totalRevenue ?? 0,
    },
    items: mappedItems,
    pagination: buildPagination(totalSales, page, pageSize, all),
  };
}

async function buildPendingReturnsReport(page: number, pageSize: number, all: boolean) {
  const filter: Record<string, unknown> = { status: { $in: ["confirmed", "in_use"] } };
  const now = new Date();

  const { skip, limit } = skipLimit(page, pageSize, all);

  const [totalPending, overdueCount, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.countDocuments({ ...filter, rentalEndDate: { $lt: now } }),
    Booking.find(filter)
      .populate("customer", "name phone")
      .populate("items.product", "name")
      .sort({ rentalEndDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const mappedItems = bookings.map((b) => {
    const rentalEndDate = b.rentalEndDate;
    const isOverdue = rentalEndDate < now;
    const daysOverdue = isOverdue
      ? Math.ceil((now.getTime() - rentalEndDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      _id: String(b._id),
      bookingNumber: b.bookingNumber,
      customer: (b.customer as unknown as { name: string } | null)?.name ?? "—",
      customerPhone: (b.customer as unknown as { phone?: string } | null)?.phone,
      product:
        b.items
          .map((item) => (item.product as unknown as { name: string } | null)?.name)
          .filter(Boolean)
          .join(", ") || "—",
      status: b.status,
      rentalEndDate: rentalEndDate.toISOString(),
      isOverdue,
      daysOverdue,
      securityDeposit: b.securityDeposit,
    };
  });

  return {
    summary: { totalPending, overdueCount },
    items: mappedItems,
    pagination: buildPagination(totalPending, page, pageSize, all),
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") ?? "products";
    const rangePreset = (searchParams.get("range") ?? "month") as DateRangePreset;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    const serviceType = searchParams.get("serviceType");
    const all = searchParams.get("all") === "true";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

    const range = resolveDateRange(rangePreset, from, to);
    const dateFilter = buildDateFilter("createdAt", range);

    let report: { summary: Record<string, unknown>; items: unknown[]; pagination: Pagination };

    switch (type) {
      case "products":
        report = await buildProductsReport(dateFilter, status, page, pageSize, all);
        break;
      case "bookings":
        report = await buildBookingsReport(dateFilter, status, page, pageSize, all);
        break;
      case "invoices":
        report = await buildInvoicesReport(dateFilter, status, page, pageSize, all);
        break;
      case "customers":
        report = await buildCustomersReport(dateFilter, page, pageSize, all);
        break;
      case "services":
        report = await buildServicesReport(dateFilter, status, serviceType, page, pageSize, all);
        break;
      case "customisation":
        report = await buildCustomisationReport(dateFilter, status, page, pageSize, all);
        break;
      case "sale":
        report = await buildSaleReport(dateFilter, page, pageSize, all);
        break;
      case "pending-returns":
        report = await buildPendingReturnsReport(page, pageSize, all);
        break;
      default:
        return apiError("Invalid report type", 400);
    }

    return apiSuccess({
      ...report,
      range: {
        from: range.from ? range.from.toISOString() : null,
        to: range.to ? range.to.toISOString() : null,
        label: range.label,
      },
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
