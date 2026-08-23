import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { SalesClient } from "@/components/admin/sales-client";

export const metadata: Metadata = { title: "Sale" };

const PAGE_SIZE = 5;

export default async function AdminSalesPage() {
  await connectToDatabase();

  const activeFilter = { deletedAt: null };

  const [sales, total, products, customers] = await Promise.all([
    Sale.find(activeFilter)
      .populate("product", "name images sku")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    Sale.countDocuments(activeFilter),
    // A dress that's been sold outright is no longer available to sell again.
    Product.find({ deletedAt: null, status: { $ne: "sold" } })
      .sort({ name: 1 })
      .select("name sku")
      .limit(500)
      .lean(),
    User.find({ role: "customer", deletedAt: null })
      .select("name email phone addresses")
      .sort({ name: 1 })
      .limit(500)
      .lean(),
  ]);

  const initialSales = sales.map((sale) => ({
    _id: String(sale._id),
    billNumber: sale.billNumber,
    saleDate: sale.saleDate.toISOString(),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerAddress: sale.customerAddress,
    product: sale.product
      ? {
          _id: String((sale.product as unknown as { _id: unknown })._id),
          name: (sale.product as unknown as { name: string }).name,
          sku: (sale.product as unknown as { sku: string }).sku,
        }
      : null,
    details: sale.details,
    totalAmount: sale.totalAmount,
  }));

  return (
    <SalesClient
      initialSales={initialSales}
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
