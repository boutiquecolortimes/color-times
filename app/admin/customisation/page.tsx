import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import { CustomisationClient } from "@/components/admin/customisation-client";

export const metadata: Metadata = { title: "Customisation" };

const PAGE_SIZE = 5;

export default async function AdminCustomisationPage() {
  await connectToDatabase();

  const activeFilter = { deletedAt: null };

  const [orders, total] = await Promise.all([
    CustomisationOrder.find(activeFilter)
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    CustomisationOrder.countDocuments(activeFilter),
  ]);

  const initialOrders = orders.map((order) => ({
    _id: String(order._id),
    billNumber: order.billNumber,
    orderDate: order.orderDate.toISOString(),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    stitchingType: order.stitchingType,
    detail: order.detail,
    measurements: order.measurements,
    totalAmount: order.totalAmount,
    advancePayment: order.advancePayment,
    dueAmount: order.dueAmount,
    status: order.status,
    notes: order.notes,
  }));

  return (
    <CustomisationClient
      initialOrders={initialOrders}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
    />
  );
}
