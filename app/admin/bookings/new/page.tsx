import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Product } from "@/models/Product";
import { BookingForm } from "@/components/admin/booking-form";

export const metadata: Metadata = { title: "New Booking" };

export default async function NewBookingPage() {
  await connectToDatabase();

  const [customers, products] = await Promise.all([
    User.find({ role: "customer", deletedAt: null })
      .select("name email")
      .sort({ name: 1 })
      .limit(200)
      .lean(),
    Product.find({ isActive: true, deletedAt: null, archivedAt: null })
      .select("name sku color rentalPricePerDay securityDeposit variants")
      .sort({ name: 1 })
      .limit(200)
      .lean(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Bookings
      </Link>

      <div>
        <h1 className="font-heading text-2xl">New Booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Book a dress for a customer. Overlapping dates are blocked automatically.
        </p>
      </div>

      <BookingForm
        customers={customers.map((customer) => ({
          _id: String(customer._id),
          name: customer.name,
          email: customer.email,
        }))}
        products={products.map((product) => ({
          _id: String(product._id),
          name: product.name,
          sku: product.sku,
          color: product.color,
          rentalPricePerDay: product.rentalPricePerDay,
          securityDeposit: product.securityDeposit,
          variants: product.variants.map((variant) => ({
            size: variant.size,
            quantityInStock: variant.quantityInStock,
          })),
        }))}
      />
    </div>
  );
}
