import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { CustomisationOrderForm } from "@/components/admin/customisation-order-form";

export const metadata: Metadata = { title: "New Customisation Order" };

export default async function NewCustomisationOrderPage() {
  await connectToDatabase();

  const customers = await User.find({ role: "customer", deletedAt: null })
    .select("name email phone addresses")
    .sort({ name: 1 })
    .limit(500)
    .lean();

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/customisation"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Customisation
      </Link>

      <div>
        <h1 className="font-heading text-2xl">New Customisation Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Custom stitching and design order for a customer.
        </p>
      </div>

      <CustomisationOrderForm
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
