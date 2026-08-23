import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import { User } from "@/models/User";
import { CustomisationClient } from "@/components/admin/customisation-client";

export const metadata: Metadata = { title: "Customisation" };

const PAGE_SIZE = 5;

export default async function AdminCustomisationPage() {
  await connectToDatabase();

  const activeFilter = { deletedAt: null };

  const [orders, total, customers] = await Promise.all([
    CustomisationOrder.find(activeFilter)
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    CustomisationOrder.countDocuments(activeFilter),
    User.find({ role: "customer", deletedAt: null })
      .select("name email phone addresses")
      .sort({ name: 1 })
      .limit(500)
      .lean(),
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
      customers={customers.map((customer) => {
        const address =
          customer.addresses?.find((a) => a.isDefault) ?? customer.addresses?.[0] ?? null;
        return {
          _id: String(customer._id),
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: address
            ? `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`
            : undefined,
        };
      })}
    />
  );
}
