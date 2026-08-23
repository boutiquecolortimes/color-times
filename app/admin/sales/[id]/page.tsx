import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import "@/models/Product";
import { SaleDetailClient } from "@/components/admin/sale-detail-client";

export const metadata: Metadata = { title: "Sale Details" };

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectToDatabase();

  const sale = await Sale.findById(id).populate("product", "name images sku").lean();
  if (!sale || sale.deletedAt) {
    notFound();
  }

  const product = sale.product as unknown as
    | { _id: unknown; name: string; images: string[]; sku: string }
    | null;

  const initialSale = {
    _id: String(sale._id),
    billNumber: sale.billNumber,
    saleDate: sale.saleDate.toISOString(),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerAddress: sale.customerAddress,
    product: product
      ? {
          _id: String(product._id),
          name: product.name,
          images: product.images ?? [],
          sku: product.sku,
        }
      : null,
    details: sale.details,
    totalAmount: sale.totalAmount,
    source: sale.source,
    createdAt: sale.createdAt.toISOString(),
  };

  return <SaleDetailClient initialSale={initialSale} />;
}
