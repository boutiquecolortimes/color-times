import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import "@/models/Product";
import { InvoiceForm } from "@/components/admin/invoice-form";

export const metadata: Metadata = { title: "New Invoice" };

export default async function NewInvoicePage() {
  await connectToDatabase();

  const [customers, bookings] = await Promise.all([
    User.find({ role: "customer", deletedAt: null })
      .select("name email")
      .sort({ name: 1 })
      .limit(200)
      .lean(),
    Booking.find({ status: { $in: ["confirmed", "in_use", "returned"] } })
      .populate("customer", "name")
      .populate("items.product", "name")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/invoices"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      <div>
        <h1 className="font-heading text-2xl">New Invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate an invoice from an existing booking, or create one manually.
        </p>
      </div>

      <InvoiceForm
        customers={customers.map((customer) => ({
          _id: String(customer._id),
          name: customer.name,
          email: customer.email,
        }))}
        bookings={bookings.map((booking) => ({
          _id: String(booking._id),
          bookingNumber: booking.bookingNumber,
          rentalFee: booking.items.reduce((sum, item) => sum + item.rentalFee, 0),
          securityDeposit: booking.securityDeposit,
          customerName: (booking.customer as unknown as { name: string } | null)?.name ?? "—",
          productName:
            booking.items
              .map((item) => (item.product as unknown as { name: string } | null)?.name)
              .filter(Boolean)
              .join(", ") || "—",
        }))}
      />
    </div>
  );
}
