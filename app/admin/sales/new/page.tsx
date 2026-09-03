import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { SaleForm } from "@/components/admin/sale-form";

export const metadata: Metadata = { title: "New Sale" };

export default async function NewSalePage() {
  await connectToDatabase();

  const [products, customers] = await Promise.all([
    // Already sold outright, or currently out on an active rental (booked /
    // reserved / picked up by a renter) — either way it's not available to
    // sell right now.
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

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/sales"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Sale
      </Link>

      <div>
        <h1 className="font-heading text-2xl">New Sale</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record an outright dress sale. It drops out of the rental and sale pickers once saved.
        </p>
      </div>

      <SaleForm
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
