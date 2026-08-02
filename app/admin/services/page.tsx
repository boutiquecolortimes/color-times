import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { ServiceOrder } from "@/models/ServiceOrder";
import { Product } from "@/models/Product";
import "@/models/Booking";
import { ServiceOrdersClient } from "@/components/admin/service-orders-client";

export const metadata: Metadata = { title: "Dry Clean & Tailor" };

const PAGE_SIZE = 5;

export default async function AdminServicesPage() {
  await connectToDatabase();

  const activeFilter = { deletedAt: null, serviceType: "dry_clean" as const };

  const [orders, total, products] = await Promise.all([
    ServiceOrder.find(activeFilter)
      .populate("product", "name images sku")
      .populate("booking", "bookingNumber")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    ServiceOrder.countDocuments(activeFilter),
    Product.find({ deletedAt: null })
      .sort({ name: 1 })
      .select("name sku")
      .limit(500)
      .lean(),
  ]);

  const initialOrders = orders.map((order) => ({
    _id: String(order._id),
    serviceType: order.serviceType,
    product: order.product
      ? {
          _id: String((order.product as unknown as { _id: unknown })._id),
          name: (order.product as unknown as { name: string }).name,
          sku: (order.product as unknown as { sku: string }).sku,
        }
      : null,
    description: order.description,
    status: order.status,
    dryCleanCharge: order.dryCleanCharge,
    ironCharge: order.ironCharge,
    stitchingCharge: order.stitchingCharge,
    stitchingType: order.stitchingType,
    otherCharge: order.otherCharge,
    totalAmount: order.totalAmount,
    assignedTo: order.assignedTo,
    sentDate: order.sentDate.toISOString(),
    expectedReturnDate: order.expectedReturnDate.toISOString(),
    notes: order.notes,
  }));

  return (
    <ServiceOrdersClient
      initialOrders={initialOrders}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
      products={products.map((product) => ({
        _id: String(product._id),
        name: product.name,
        sku: product.sku,
      }))}
    />
  );
}
