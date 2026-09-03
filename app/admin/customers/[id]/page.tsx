import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackageSearch, Receipt, ShoppingBag, Scissors } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Booking, type BookingStatus } from "@/models/Booking";
import { Invoice } from "@/models/Invoice";
import { Sale } from "@/models/Sale";
import { CustomisationOrder, type CustomisationOrderStatus } from "@/models/CustomisationOrder";
import "@/models/Product";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { InvoiceStatusBadge } from "@/components/admin/invoice-status-badge";
import { CustomisationStatusBadge } from "@/components/admin/customisation-status-badge";
import { CustomerDetailClient } from "@/components/admin/customer-detail-client";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, escapeRegex } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer Detail" };

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectToDatabase();

  const customer = await User.findById(id)
    .select("name email phone fatherName addresses isActive createdAt")
    .lean();

  if (!customer) {
    notFound();
  }

  // Sale and Customisation orders are still mostly free-text (walk-in
  // customers don't always get a linked profile) — a record made through
  // the customer picker carries the real `customer` id, but older records
  // (and any made without picking one) only have the phone typed in at the
  // time. Matching both keeps this page from being blind to everything
  // recorded before the link existed, at the cost of missing a record whose
  // phone was typed differently than what's on file.
  const phoneDigits = (customer.phone ?? "").replace(/\D/g, "").slice(-10);
  const phoneMatch = phoneDigits ? new RegExp(`${escapeRegex(phoneDigits)}$`) : null;
  const customerOrPhoneFilter = (extra: Record<string, unknown>) => ({
    ...extra,
    $or: [{ customer: id }, ...(phoneMatch ? [{ customerPhone: phoneMatch }] : [])],
  });

  const [bookings, invoices, sales, customisationOrders] = await Promise.all([
    Booking.find({ customer: id }).populate("items.product", "name").sort({ createdAt: -1 }).lean(),
    Invoice.find({ customer: id, deletedAt: null }).sort({ createdAt: -1 }).lean(),
    Sale.find(customerOrPhoneFilter({ deletedAt: null, source: "manual" }))
      .populate("product", "name sku")
      .sort({ createdAt: -1 })
      .lean(),
    CustomisationOrder.find(customerOrPhoneFilter({ deletedAt: null }))
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const depositHeld = bookings
    .filter((b) => ["confirmed", "in_use"].includes(b.status))
    .reduce((sum, b) => sum + b.securityDeposit, 0);
  const depositRefundedTotal = bookings
    .filter((b) => b.status === "returned" && b.depositRefunded)
    .reduce((sum, b) => sum + (b.depositRefundAmount ?? 0), 0);
  const totalPendingPayment = invoices
    .filter((inv) => inv.status !== "cancelled")
    .reduce((sum, inv) => sum + inv.amountDue, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <CustomerDetailClient
        initialCustomer={{
          _id: String(customer._id),
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          fatherName: customer.fatherName,
          isActive: customer.isActive,
          createdAt: customer.createdAt.toISOString(),
          addresses: customer.addresses.map((address) => ({
            line1: address.line1,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
          })),
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Security Deposit Held</p>
          <p className="mt-1 font-heading text-xl">&#8377;{depositHeld.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Deposit Refunded (lifetime)</p>
          <p className="mt-1 font-heading text-xl">
            &#8377;{depositRefundedTotal.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Pending Payment</p>
          <p className="mt-1 font-heading text-xl">
            &#8377;{totalPendingPayment.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg">Booking History</h2>
        <div className="mt-4">
          {bookings.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No bookings yet"
              description="This customer hasn't made any bookings."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Booking #</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Advance Paid</th>
                    <th className="px-4 py-3">Deposit</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={String(booking._id)} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/admin/bookings/${booking._id}`}
                          className="hover:text-accent hover:underline"
                        >
                          {booking.bookingNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {booking.items
                          .map((item) => (item.product as unknown as { name: string } | null)?.name)
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        &#8377;{booking.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        &#8377;{(booking.advancePaid ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {booking.status === "returned"
                          ? booking.depositRefunded
                            ? `Refunded ₹${(booking.depositRefundAmount ?? 0).toLocaleString("en-IN")}`
                            : "Not refunded"
                          : `₹${booking.securityDeposit.toLocaleString("en-IN")} held`}
                      </td>
                      <td className="px-4 py-3">
                        <BookingStatusBadge status={booking.status as BookingStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg">Invoices &amp; Payments</h2>
        <div className="mt-4">
          {invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description="This customer has no invoices on record."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Issued</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={String(invoice._id)} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/admin/invoices/${invoice._id}`}
                          className="hover:text-accent hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}
                      </td>
                      <td className="px-4 py-3">&#8377;{invoice.total.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        &#8377;{invoice.amountPaid.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        &#8377;{invoice.amountDue.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg">Sale History</h2>
        <div className="mt-4">
          {sales.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No sales yet"
              description="This customer has no outright dress purchases on record."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Bill #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const product = sale.product as unknown as { name: string; sku: string } | null;
                    return (
                      <tr key={String(sale._id)} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/admin/sales/${sale._id}`}
                            className="hover:text-accent hover:underline"
                          >
                            {sale.billNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(sale.saleDate)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {product ? `${product.name} (${product.sku})` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          &#8377;{sale.totalAmount.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg">Customisation History</h2>
        <div className="mt-4">
          {customisationOrders.length === 0 ? (
            <EmptyState
              icon={Scissors}
              title="No customisation orders yet"
              description="This customer has no custom stitching orders on record."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Bill #</th>
                    <th className="px-4 py-3">Order Date</th>
                    <th className="px-4 py-3">Stitching Type</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Advance</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customisationOrders.map((order) => (
                    <tr key={String(order._id)} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{order.billNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(order.orderDate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{order.stitchingType}</td>
                      <td className="px-4 py-3">
                        &#8377;{order.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        &#8377;{order.advancePayment.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        &#8377;{order.dueAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <CustomisationStatusBadge status={order.status as CustomisationOrderStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
