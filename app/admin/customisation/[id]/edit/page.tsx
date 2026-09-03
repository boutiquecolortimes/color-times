import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import { User } from "@/models/User";
import { CustomisationOrderForm } from "@/components/admin/customisation-order-form";
import { requireRole } from "@/lib/auth/session";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import type { CustomisationOrderInput } from "@/lib/validations/customisation-order";

export const metadata: Metadata = { title: "Edit Customisation Order" };

export default async function EditCustomisationOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Editing an order's own details is Admin-and-up work, same gate as the
  // PATCH route itself (see app/api/admin/customisation-orders/[id]/route.ts)
  // and Booking's edit page.
  const currentUser = await requireRole(MANAGER_ROLES);
  if (!currentUser) {
    redirect(`/admin/customisation`);
  }

  await connectToDatabase();

  const [order, customers] = await Promise.all([
    CustomisationOrder.findById(id).lean(),
    User.find({ role: "customer", deletedAt: null })
      .select("name email phone addresses")
      .sort({ name: 1 })
      .limit(500)
      .lean(),
  ]);

  if (!order || order.deletedAt) {
    notFound();
  }

  const defaultValues: CustomisationOrderInput = {
    orderDate: order.orderDate.toISOString().slice(0, 10),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    customer: order.customer ? String(order.customer) : "",
    stitchingType: order.stitchingType,
    detail: order.detail,
    measurements: order.measurements ?? {},
    totalAmount: order.totalAmount,
    advancePayment: order.advancePayment,
    notes: order.notes ?? "",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/customisation"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Customisation
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Edit Customisation Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bill {order.billNumber}.</p>
      </div>

      <CustomisationOrderForm
        orderId={id}
        defaultValues={defaultValues}
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
