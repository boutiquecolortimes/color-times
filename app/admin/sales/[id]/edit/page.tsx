import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { SaleForm } from "@/components/admin/sale-form";
import { requireRole } from "@/lib/auth/session";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import type { SaleInput } from "@/lib/validations/sale";

export const metadata: Metadata = { title: "Edit Sale" };

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const currentUser = await requireRole(MANAGER_ROLES);
  if (!currentUser) {
    redirect(`/admin/sales/${id}`);
  }

  await connectToDatabase();

  const [sale, activeProducts, customers] = await Promise.all([
    Sale.findById(id).lean(),
    Product.find({ deletedAt: null, status: { $nin: ["sold", "booked", "reserved", "picked_up"] } })
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

  if (!sale || sale.deletedAt) {
    notFound();
  }

  // The dress this sale is actually pointed at might not be in the active
  // list any more (it's this very sale that marked it "sold") — merge it
  // back in so the picker shows its real name instead of a blank row,
  // mirroring the booking edit page's extraProducts pattern.
  const activeProductIds = new Set(activeProducts.map((product) => String(product._id)));
  const products = activeProductIds.has(String(sale.product))
    ? activeProducts
    : [
        ...activeProducts,
        ...(await Product.find({ _id: sale.product }).select("name sku").lean()),
      ];

  const defaultValues: SaleInput = {
    saleDate: sale.saleDate.toISOString().slice(0, 10),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerAddress: sale.customerAddress,
    customer: sale.customer ? String(sale.customer) : "",
    product: String(sale.product),
    details: sale.details ?? "",
    totalAmount: sale.totalAmount,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/admin/sales/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Sale
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Edit Sale</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bill {sale.billNumber}.</p>
      </div>

      <SaleForm
        saleId={id}
        defaultValues={defaultValues}
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
    </div>
  );
}
