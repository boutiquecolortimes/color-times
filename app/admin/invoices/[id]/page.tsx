import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/Booking";
import "@/models/User";
import { InvoiceDetailClient } from "@/components/admin/invoice-detail-client";

export const metadata: Metadata = { title: "Invoice Detail" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectToDatabase();

  const invoice = await Invoice.findById(id)
    .populate("customer", "name email phone")
    .populate("booking", "bookingNumber rentalStartDate rentalEndDate")
    .populate("payments.recordedBy", "name")
    .lean();

  if (!invoice) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/invoices"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      <InvoiceDetailClient
        initialInvoice={{
          _id: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          customer: invoice.customer
            ? {
                name: (invoice.customer as unknown as { name: string }).name,
                email: (invoice.customer as unknown as { email: string }).email,
                phone: (invoice.customer as unknown as { phone?: string }).phone,
              }
            : { name: "—", email: "—" },
          booking: invoice.booking
            ? { bookingNumber: (invoice.booking as unknown as { bookingNumber: string }).bookingNumber }
            : null,
          // A handful of invoices predate later schema additions or were
          // bulk-imported outside the app — .lean() doesn't backfill schema
          // defaults, so these can still be missing on the stored document.
          lineItems: invoice.lineItems ?? [],
          subtotal: invoice.subtotal ?? 0,
          discountAmount: invoice.discountAmount ?? 0,
          taxRate: invoice.taxRate ?? 0,
          taxAmount: invoice.taxAmount ?? 0,
          securityDeposit: invoice.securityDeposit ?? 0,
          depositRefunded: invoice.depositRefunded ?? false,
          total: invoice.total ?? 0,
          amountPaid: invoice.amountPaid ?? 0,
          amountDue: invoice.amountDue ?? 0,
          dueDate: (invoice.dueDate ?? invoice.createdAt ?? new Date()).toISOString(),
          issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
          createdAt: (invoice.createdAt ?? new Date()).toISOString(),
          notes: invoice.notes,
          payments: (invoice.payments ?? []).map((payment) => ({
            _id: String(payment._id),
            amount: payment.amount,
            method: payment.method,
            reference: payment.reference,
            note: payment.note,
            paidAt: payment.paidAt.toISOString(),
            recordedByName:
              (payment.recordedBy as unknown as { name: string } | null)?.name ?? "—",
          })),
        }}
      />
    </div>
  );
}
